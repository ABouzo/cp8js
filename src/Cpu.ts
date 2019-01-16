// tslint:disable:no-bitwise
export default class Cpu {
    private static fpsInterval: number = 1000 / 603;
    private lastDelayTime: number;
    private ram: number[];
    private graphicMemory: boolean[];
    private running: boolean = false;
    private readonly stack: number[] = new Array(16);
    private readonly r = {
        delay: 0,
        i: 0, // 16 bit
        pc: 0, // 16 bit program counter
        sound: 0,
        sp: 0, // stack pointer
        v: new Array(16),
    };
    private readonly font: number[] = [
        0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
        0x20, 0x60, 0x20, 0x20, 0x70, // 1
        0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
        0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
        0x90, 0x90, 0xF0, 0x10, 0x10, // 4
        0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
        0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
        0xF0, 0x10, 0x20, 0x40, 0x40, // 7
        0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
        0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
        0xF0, 0x90, 0xF0, 0x90, 0x90, // A
        0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
        0xF0, 0x80, 0x80, 0x80, 0xF0, // C
        0xE0, 0x90, 0x90, 0x90, 0xE0, // D
        0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
        0xF0, 0x80, 0xF0, 0x80, 0x80, // F
    ];

    private readonly ops: Array<(word: number) => void>;

    constructor(private readonly display?: IDisplay, private readonly debugToolImpl?: IDebugTool,
                private readonly controller?: IController) {
        this.lastDelayTime = Date.now();
        this.ops = this.initOps();
        this.graphicMemory = new Array<boolean>(64 * 32);
        this.ram = this.buildMemory();

        if (debugToolImpl) {
            debugToolImpl.onGeneralRegisterChange(this.r.v);
            debugToolImpl.onSpecialRegisterChange(this.r.i, this.r.delay, this.r.sound);
            debugToolImpl.onStackChange(this.stack, this.r.sp);
            debugToolImpl.onStep(this.r.pc, 0, this.getInstruction());
        }
    }

    public loadRom(romByteArray: number[]) {
        if (this.ram.length > 512) {
            this.ram = this.buildMemory();
        }
        this.ram.push(...romByteArray);
        this.resetStates();
    }

    public start() {
        if (!this.running) {
            const loop = () => {
                for (let i = 0; i < 8; i++) {
                    this.step();
                }
                if (this.running) {
                    requestAnimationFrame(() => loop());
                }
            };
            this.running = true;
            loop();
        }
    }

    public stop() {
        this.running = false;
    }

    public reset() {
        this.stop();
        this.resetStates();
        this.start();
    }

    public step() {
        const now = Date.now();
        const timeSinceLastDelay = now - this.lastDelayTime;
        if (timeSinceLastDelay > Cpu.fpsInterval) {
            this.lastDelayTime = now - (timeSinceLastDelay % Cpu.fpsInterval);
            if (this.r.delay > 0) {
                --this.r.delay;
            }
            if (this.r.sound > 0) {
                --this.r.sound;
            }
        }

        const word = this.getInstruction();
        this.ops[this.getOp(word)](word);
        if (this.debugToolImpl) {
            this.debugToolImpl.onStep(this.r.pc - 2, word, this.getInstruction());
            this.debugToolImpl.onSpecialRegisterChange(this.r.i, this.r.delay, this.r.sound);
        }
    }

    private readonly getOp = (word: number) => (word & 0xF000) >> 12;
    private readonly getX = (word: number) => (word & 0x0F00) >> 8;
    private readonly getY = (word: number) => (word & 0x00F0) >> 4;
    private readonly getN = (word: number) => (word & 0x000F);
    private readonly getKK = (word: number) => (word & 0x00FF);
    private readonly getNNN = (word: number) => (word & 0x0FFF);
    private readonly getMostSignificantBit = (byte: number) => (byte & 0x80 >> 7);

    private initOps(): Array<(word: number) => void> {
        const ops = [];
        ops[0x0] =
            // 0
            (word: number) => {
                switch (this.getKK(word)) {
                    case 0xE0: // Clear the display
                        this.graphicMemory = new Array<boolean>(64 * 32);
                        if (this.display) {
                            this.display.draw(this.graphicMemory);
                        }
                        break;
                    case 0xEE: // Return from a subroutine
                        this.r.sp -= 1;
                        if (this.debugToolImpl) {
                            this.debugToolImpl.onStackChange(this.stack, this.r.sp);
                        }
                        this.r.pc = this.stack[this.r.sp];
                        break;
                }
                this.r.pc += 2;
            };
        ops[0x1] =
            // 1 Jump to nnn
            (word: number) => {
                this.r.pc = this.getNNN(word);
            };
        ops[0x2] =
            // 2 Call to nnn
            (word: number) => {
                this.stack[this.r.sp] = this.r.pc;
                this.r.sp += 1;
                this.r.pc = this.getNNN(word);
                if (this.debugToolImpl) {
                    this.debugToolImpl.onStackChange(this.stack, this.r.sp);
                }
            };
        ops[0x3] =
            // 3 Skip next inststruction if equal
            (word: number) => {
                const valueInRegister: number = this.r.v[this.getX(word)];
                const valueInWord: number = this.getKK(word);
                if (valueInRegister === valueInWord) {
                    this.r.pc += 2;
                }
                this.r.pc += 2;
            };
        ops[0x4] =
            // 4 Skip next instruction if not equal
            (word: number) => {
                const valueInRegister: number = this.r.v[this.getX(word)];
                const valueInWord: number = this.getKK(word);
                if (valueInRegister !== valueInWord) {
                    this.r.pc += 2;
                }
                this.r.pc += 2;
            };
        ops[0x5] =
            // 5 Skip next instruction if Vx === Vy are equal
            (word: number) => {
                const valueInRegisterX: number = this.r.v[this.getX(word)];
                const valueInRegisterY: number = this.r.v[this.getY(word)];
                if (valueInRegisterX === valueInRegisterY) {
                    this.r.pc += 2;
                }
                this.r.pc += 2;
            };
        ops[0x6] =
            // 6 Set
            (word: number) => {
                const valueInWord: number = this.getKK(word);
                this.r.v[this.getX(word)] = valueInWord;
                this.r.pc += 2;
                if (this.debugToolImpl) {
                    this.debugToolImpl.onGeneralRegisterChange(this.r.v);
                }
            };
        ops[0x7] =
            // 7 Add
            (word: number) => {
                const newValue = this.getKK(word) + this.r.v[this.getX(word)];
                this.r.v[this.getX(word)] = newValue & 0xFF;
                this.r.pc += 2;
                if (this.debugToolImpl) {
                    this.debugToolImpl.onGeneralRegisterChange(this.r.v);
                }
            };
        ops[0x8] =
            // 8
            (word: number) => {
                const valueOfX = this.getX(word);
                const valueInRegisterX: number = this.r.v[valueOfX];
                const valueInRegisterY: number = this.r.v[this.getY(word)];
                switch (this.getN(word)) {
                    case 0x0:
                        this.r.v[valueOfX] = valueInRegisterY;
                        break;
                    case 0x1:
                        this.r.v[valueOfX] = valueInRegisterX | valueInRegisterY;
                        break;
                    case 0x2:
                        this.r.v[valueOfX] = valueInRegisterX & valueInRegisterY;
                        break;
                    case 0x3:
                        this.r.v[valueOfX] = valueInRegisterX ^ valueInRegisterY;
                        break;
                    case 0x4:
                        const result = valueInRegisterX + valueInRegisterY;
                        this.r.v[0xF] = (result > 0xFF) ? 0x1 : 0x0;
                        this.r.v[valueOfX] = result & 0xFF;
                        break;
                    case 0x5:
                        this.r.v[0xF] = (valueInRegisterX > valueInRegisterY) ? 1 : 0;
                        this.r.v[valueOfX] = (valueInRegisterX - valueInRegisterY) & 0xFF;
                        break;
                    case 0x6:
                        this.r.v[0xF] = valueInRegisterX & 0x1;
                        this.r.v[valueOfX] = valueInRegisterX >> 1; // Divide by 2
                        break;
                    case 0x7:
                        this.r.v[0xF] = (valueInRegisterY > valueInRegisterX) ? 1 : 0;
                        this.r.v[valueOfX] = (valueInRegisterY - valueInRegisterX) & 0xFF;
                        break;
                    case 0xE:
                        this.r.v[0xF] = this.getMostSignificantBit(valueInRegisterX);
                        this.r.v[valueOfX] = (valueInRegisterX << 1) & 0xFF; // Multiply by 2;
                        break;
                }
                if (this.debugToolImpl) {
                    this.debugToolImpl.onGeneralRegisterChange(this.r.v);
                }
                this.r.pc += 2;
            };
        ops[0x9] =
            // 9
            (word: number) => {
                if (this.r.v[this.getX(word)] !== this.r.v[this.getY(word)]) {
                    this.r.pc += 2;
                }
                this.r.pc += 2;
            };
        ops[0xA] =
            // A
            (word: number) => {
                this.r.i = this.getNNN(word);
                if (this.debugToolImpl) {
                    this.debugToolImpl.onSpecialRegisterChange(this.r.i, this.r.delay, this.r.sound);
                }
                this.r.pc += 2;
            };
        ops[0xB] =
            // B
            (word: number) => {
                this.r.pc = this.getNNN(word) + this.r.v[0x0];
            };
        ops[0xC] =
            // C
            (word: number) => {
                const randomNumber = Math.floor(Math.random() * 0xFF);
                this.r.v[this.getX(word)] = randomNumber & this.getKK(word);
                this.r.pc += 2;
                if (this.debugToolImpl) {
                    this.debugToolImpl.onGeneralRegisterChange(this.r.v);
                }
            };
        ops[0xD] =
            // D
            (word: number) => {
                this.r.v[0xF] = 0;
                const numberOfBytes: number = this.getN(word);
                const startingX = this.r.v[this.getX(word)];
                const startingY = this.r.v[this.getY(word)];
                const startingMemoryLocation = this.r.i;

                for (let y = 0; y < numberOfBytes; y++) {
                    const byte: number = this.ram[startingMemoryLocation + y];
                    for (let x = 0; x < 8; x++) {
                        // const bit: number = (byte >> (7 - x)) & 0x1;
                        // let xPos = startingX + x;
                        // let yPos = startingY + y;
                        // xPos = (xPos >= 64) ? xPos - 64 : xPos;
                        // yPos = (yPos >= 32) ? yPos - 32 : yPos;
                        // this.r.v[0xF] = (this.setPixel(xPos, yPos, !!bit)) ? 0x1 : 0x0;
                        if (((byte & (0x80 >> x)) !== 0)) {
                            const collision = (this.setPixel(startingX + x, startingY + y));
                            // tslint:disable-next-line:no-console
                            if (collision) {
                                this.r.v[0xF] = 1;
                            }
                        }
                    }
                }
                this.r.pc += 2;
                if (this.display) {
                    this.display.draw(this.graphicMemory);
                }
                if (this.debugToolImpl) {
                    this.debugToolImpl.onGeneralRegisterChange(this.r.v);
                }
            };
        ops[0xE] =
            // E
            (word: number) => {
                const valueInRegisterX = this.r.v[this.getX(word)];
                const isKeyPressed = (this.controller) ? this.controller.isButtonPressed(valueInRegisterX) : false;
                switch (this.getKK(word)) {
                    case 0x9E: // Skip next instruction if key is pressed
                        if (isKeyPressed) {
                            this.r.pc += 2;
                        }
                        break;
                    case 0xA1: // Skip next instruction if key is not pressed
                        if (!isKeyPressed) {
                            this.r.pc += 2;
                        }
                        break;
                }
                this.r.pc += 2;
            };
        ops[0xF] =
            // F
            (word: number) => {
                const valueOfX = this.getX(word);
                const valueInRegisterX = this.r.v[valueOfX];
                switch (this.getKK(word)) {
                    case 0x07: // Set Vx = delay timer
                        this.r.v[valueOfX] = this.r.delay;
                        if (this.debugToolImpl) {
                            this.debugToolImpl.onGeneralRegisterChange(this.r.v);
                        }
                        break;
                    case 0x0A: // Wait for keypress, store value in Vx
                        const keyPressed = (this.controller) ? this.controller.getPressedButton() : undefined;
                        if (keyPressed) {
                            this.r.v[valueOfX] = keyPressed;
                        } else {
                            return;
                        }
                        break;
                    case 0x15: // Set delay timer = Vx
                        this.r.delay = valueInRegisterX;
                        if (this.debugToolImpl) {
                            this.debugToolImpl.onSpecialRegisterChange(this.r.i, this.r.delay, this.r.sound);
                        }
                        break;
                    case 0x18: // Set sound timer = Vx
                        this.r.sound = valueInRegisterX;
                        if (this.debugToolImpl) {
                            this.debugToolImpl.onSpecialRegisterChange(this.r.i, this.r.delay, this.r.sound);
                        }
                        break;
                    case 0x1E: // Set i = i + Vx
                        this.r.i += valueInRegisterX;
                        if (this.debugToolImpl) {
                            this.debugToolImpl.onSpecialRegisterChange(this.r.i, this.r.delay, this.r.sound);
                        }
                        break;
                    case 0x29: // Set I to the location of the sprite for the character in Vx
                        this.r.i = valueInRegisterX * 0x5;
                        if (this.debugToolImpl) {
                            this.debugToolImpl.onSpecialRegisterChange(this.r.i, this.r.delay, this.r.sound);
                        }
                        break;
                    case 0x33: // Store decimal value of Vx in memory locations i, i+1, i+2
                        this.ram[this.r.i] = valueInRegisterX / 100;
                        this.ram[this.r.i + 1] = (valueInRegisterX / 10) % 10;
                        this.ram[this.r.i + 2] = (valueInRegisterX % 100) % 10;
                        if (this.debugToolImpl) {
                            this.debugToolImpl.onRamChange(this.ram);
                        }
                        break;
                    case 0x55: // Store register V0 through Vx in memory starting at location i
                        for (let location = 0; location <= valueOfX; location++) {
                            this.ram[this.r.i + location] = this.r.v[location];
                        }
                        if (this.debugToolImpl) {
                            this.debugToolImpl.onRamChange(this.ram);
                        }
                        break;
                    case 0x65: // Read registers V0 through Vx from memory starting at location i
                        for (let location = 0; location <= valueOfX; location++) {
                            this.r.v[location] = this.ram[this.r.i + location];
                        }
                        if (this.debugToolImpl) {
                            this.debugToolImpl.onGeneralRegisterChange(this.r.v);
                        }
                        break;
                }
                this.r.pc += 2;
            };
        return ops;
    }

    private resetStates() {
        this.lastDelayTime = Date.now();
        this.graphicMemory = new Array<boolean>(64 * 32);

        this.r.pc = 0x200;
        this.r.v = new Array(16);
        this.r.delay = 0;
        this.r.sound = 0;
        this.r.i = 0;
        this.r.sp = 0;
    }

    private buildMemory(): number[] {
        const ram: number[] = new Array(512 - this.font.length);
        ram.unshift(...this.font);
        if (this.debugToolImpl) {
            this.debugToolImpl.onRamChange(this.ram);
        }
        return ram;
    }

    private getInstruction(): number {
        const firstByte = this.ram[this.r.pc];
        const secondByte = this.ram[this.r.pc + 1];
        return (firstByte << 8) ^ secondByte;
    }

    private setPixel(x: number, y: number): boolean {
        const width = 64;
        const height = 32;

        // If the pixel exceeds the dimensions,
        // wrap it back around.
        if (x > width) {
            x -= width;
        } else if (x < 0) {
            x += width;
        }

        if (y > height) {
            y -= height;
        } else if (y < 0) {
            y += height;
        }

        const location = x + (width * y);
        const old = this.graphicMemory[location];
        this.graphicMemory[location] = this.graphicMemory[location] ? !true : true;
        return !this.graphicMemory[location];
    }
}

export interface IDisplay {
    draw: (gfxMemory: boolean[]) => void;
}

export interface IDebugTool {
    onRamChange: (ram: number[]) => void;
    onStackChange: (stack: number[], stackPointer: number) => void;
    onGeneralRegisterChange: (Vx: number[]) => void;
    onSpecialRegisterChange: (I: number, delay: number, sound: number) => void;
    onStep: (pc: number, word: number, nextWord: number) => void;
}

export interface IController {
    getPressedButton: () => number | undefined;
    isButtonPressed: (key: number) => boolean;
}
