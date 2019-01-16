'use strict';

// tslint:disable:no-bitwise
var Cpu = /** @class */ (function () {
    function Cpu(display, debugToolImpl, controller) {
        this.display = display;
        this.debugToolImpl = debugToolImpl;
        this.controller = controller;
        this.running = false;
        this.stack = new Array(16);
        this.r = {
            delay: 0,
            i: 0,
            pc: 0,
            sound: 0,
            sp: 0,
            v: new Array(16),
        };
        this.font = [
            0xF0, 0x90, 0x90, 0x90, 0xF0,
            0x20, 0x60, 0x20, 0x20, 0x70,
            0xF0, 0x10, 0xF0, 0x80, 0xF0,
            0xF0, 0x10, 0xF0, 0x10, 0xF0,
            0x90, 0x90, 0xF0, 0x10, 0x10,
            0xF0, 0x80, 0xF0, 0x10, 0xF0,
            0xF0, 0x80, 0xF0, 0x90, 0xF0,
            0xF0, 0x10, 0x20, 0x40, 0x40,
            0xF0, 0x90, 0xF0, 0x90, 0xF0,
            0xF0, 0x90, 0xF0, 0x10, 0xF0,
            0xF0, 0x90, 0xF0, 0x90, 0x90,
            0xE0, 0x90, 0xE0, 0x90, 0xE0,
            0xF0, 0x80, 0x80, 0x80, 0xF0,
            0xE0, 0x90, 0x90, 0x90, 0xE0,
            0xF0, 0x80, 0xF0, 0x80, 0xF0,
            0xF0, 0x80, 0xF0, 0x80, 0x80,
        ];
        this.getOp = function (word) { return (word & 0xF000) >> 12; };
        this.getX = function (word) { return (word & 0x0F00) >> 8; };
        this.getY = function (word) { return (word & 0x00F0) >> 4; };
        this.getN = function (word) { return (word & 0x000F); };
        this.getKK = function (word) { return (word & 0x00FF); };
        this.getNNN = function (word) { return (word & 0x0FFF); };
        this.getMostSignificantBit = function (byte) { return (byte & 0x80 >> 7); };
        this.lastDelayTime = Date.now();
        this.ops = this.initOps();
        this.graphicMemory = new Array(64 * 32);
        this.ram = this.buildMemory();
        if (debugToolImpl) {
            debugToolImpl.onGeneralRegisterChange(this.r.v);
            debugToolImpl.onSpecialRegisterChange(this.r.i, this.r.delay, this.r.sound);
            debugToolImpl.onStackChange(this.stack, this.r.sp);
            debugToolImpl.onStep(this.r.pc, 0, this.getInstruction());
        }
    }
    Cpu.prototype.loadRom = function (romByteArray) {
        var _a;
        if (this.ram.length > 512) {
            this.ram = this.buildMemory();
        }
        (_a = this.ram).push.apply(_a, romByteArray);
        this.resetStates();
    };
    Cpu.prototype.start = function () {
        var _this = this;
        if (!this.running) {
            var loop_1 = function () {
                for (var i = 0; i < 8; i++) {
                    _this.step();
                }
                if (_this.running) {
                    requestAnimationFrame(function () { return loop_1(); });
                }
            };
            this.running = true;
            loop_1();
        }
    };
    Cpu.prototype.stop = function () {
        this.running = false;
    };
    Cpu.prototype.reset = function () {
        this.stop();
        this.resetStates();
        this.start();
    };
    Cpu.prototype.step = function () {
        var now = Date.now();
        var timeSinceLastDelay = now - this.lastDelayTime;
        if (timeSinceLastDelay > Cpu.fpsInterval) {
            this.lastDelayTime = now - (timeSinceLastDelay % Cpu.fpsInterval);
            if (this.r.delay > 0) {
                --this.r.delay;
            }
            if (this.r.sound > 0) {
                --this.r.sound;
            }
        }
        var word = this.getInstruction();
        this.ops[this.getOp(word)](word);
        if (this.debugToolImpl) {
            this.debugToolImpl.onStep(this.r.pc - 2, word, this.getInstruction());
            this.debugToolImpl.onSpecialRegisterChange(this.r.i, this.r.delay, this.r.sound);
        }
    };
    Cpu.prototype.initOps = function () {
        var _this = this;
        var ops = [];
        ops[0x0] =
            // 0
            function (word) {
                switch (_this.getKK(word)) {
                    case 0xE0: // Clear the display
                        _this.graphicMemory = new Array(64 * 32);
                        if (_this.display) {
                            _this.display.draw(_this.graphicMemory);
                        }
                        break;
                    case 0xEE: // Return from a subroutine
                        _this.r.sp -= 1;
                        if (_this.debugToolImpl) {
                            _this.debugToolImpl.onStackChange(_this.stack, _this.r.sp);
                        }
                        _this.r.pc = _this.stack[_this.r.sp];
                        break;
                }
                _this.r.pc += 2;
            };
        ops[0x1] =
            // 1 Jump to nnn
            function (word) {
                _this.r.pc = _this.getNNN(word);
            };
        ops[0x2] =
            // 2 Call to nnn
            function (word) {
                _this.stack[_this.r.sp] = _this.r.pc;
                _this.r.sp += 1;
                _this.r.pc = _this.getNNN(word);
                if (_this.debugToolImpl) {
                    _this.debugToolImpl.onStackChange(_this.stack, _this.r.sp);
                }
            };
        ops[0x3] =
            // 3 Skip next inststruction if equal
            function (word) {
                var valueInRegister = _this.r.v[_this.getX(word)];
                var valueInWord = _this.getKK(word);
                if (valueInRegister === valueInWord) {
                    _this.r.pc += 2;
                }
                _this.r.pc += 2;
            };
        ops[0x4] =
            // 4 Skip next instruction if not equal
            function (word) {
                var valueInRegister = _this.r.v[_this.getX(word)];
                var valueInWord = _this.getKK(word);
                if (valueInRegister !== valueInWord) {
                    _this.r.pc += 2;
                }
                _this.r.pc += 2;
            };
        ops[0x5] =
            // 5 Skip next instruction if Vx === Vy are equal
            function (word) {
                var valueInRegisterX = _this.r.v[_this.getX(word)];
                var valueInRegisterY = _this.r.v[_this.getY(word)];
                if (valueInRegisterX === valueInRegisterY) {
                    _this.r.pc += 2;
                }
                _this.r.pc += 2;
            };
        ops[0x6] =
            // 6 Set
            function (word) {
                var valueInWord = _this.getKK(word);
                _this.r.v[_this.getX(word)] = valueInWord;
                _this.r.pc += 2;
                if (_this.debugToolImpl) {
                    _this.debugToolImpl.onGeneralRegisterChange(_this.r.v);
                }
            };
        ops[0x7] =
            // 7 Add
            function (word) {
                var newValue = _this.getKK(word) + _this.r.v[_this.getX(word)];
                _this.r.v[_this.getX(word)] = newValue & 0xFF;
                _this.r.pc += 2;
                if (_this.debugToolImpl) {
                    _this.debugToolImpl.onGeneralRegisterChange(_this.r.v);
                }
            };
        ops[0x8] =
            // 8
            function (word) {
                var valueOfX = _this.getX(word);
                var valueInRegisterX = _this.r.v[valueOfX];
                var valueInRegisterY = _this.r.v[_this.getY(word)];
                switch (_this.getN(word)) {
                    case 0x0:
                        _this.r.v[valueOfX] = valueInRegisterY;
                        break;
                    case 0x1:
                        _this.r.v[valueOfX] = valueInRegisterX | valueInRegisterY;
                        break;
                    case 0x2:
                        _this.r.v[valueOfX] = valueInRegisterX & valueInRegisterY;
                        break;
                    case 0x3:
                        _this.r.v[valueOfX] = valueInRegisterX ^ valueInRegisterY;
                        break;
                    case 0x4:
                        var result = valueInRegisterX + valueInRegisterY;
                        _this.r.v[0xF] = (result > 0xFF) ? 0x1 : 0x0;
                        _this.r.v[valueOfX] = result & 0xFF;
                        break;
                    case 0x5:
                        _this.r.v[0xF] = (valueInRegisterX > valueInRegisterY) ? 1 : 0;
                        _this.r.v[valueOfX] = (valueInRegisterX - valueInRegisterY) & 0xFF;
                        break;
                    case 0x6:
                        _this.r.v[0xF] = valueInRegisterX & 0x1;
                        _this.r.v[valueOfX] = valueInRegisterX >> 1; // Divide by 2
                        break;
                    case 0x7:
                        _this.r.v[0xF] = (valueInRegisterY > valueInRegisterX) ? 1 : 0;
                        _this.r.v[valueOfX] = (valueInRegisterY - valueInRegisterX) & 0xFF;
                        break;
                    case 0xE:
                        _this.r.v[0xF] = _this.getMostSignificantBit(valueInRegisterX);
                        _this.r.v[valueOfX] = (valueInRegisterX << 1) & 0xFF; // Multiply by 2;
                        break;
                }
                if (_this.debugToolImpl) {
                    _this.debugToolImpl.onGeneralRegisterChange(_this.r.v);
                }
                _this.r.pc += 2;
            };
        ops[0x9] =
            // 9
            function (word) {
                if (_this.r.v[_this.getX(word)] !== _this.r.v[_this.getY(word)]) {
                    _this.r.pc += 2;
                }
                _this.r.pc += 2;
            };
        ops[0xA] =
            // A
            function (word) {
                _this.r.i = _this.getNNN(word);
                if (_this.debugToolImpl) {
                    _this.debugToolImpl.onSpecialRegisterChange(_this.r.i, _this.r.delay, _this.r.sound);
                }
                _this.r.pc += 2;
            };
        ops[0xB] =
            // B
            function (word) {
                _this.r.pc = _this.getNNN(word) + _this.r.v[0x0];
            };
        ops[0xC] =
            // C
            function (word) {
                var randomNumber = Math.floor(Math.random() * 0xFF);
                _this.r.v[_this.getX(word)] = randomNumber & _this.getKK(word);
                _this.r.pc += 2;
                if (_this.debugToolImpl) {
                    _this.debugToolImpl.onGeneralRegisterChange(_this.r.v);
                }
            };
        ops[0xD] =
            // D
            function (word) {
                _this.r.v[0xF] = 0;
                var numberOfBytes = _this.getN(word);
                var startingX = _this.r.v[_this.getX(word)];
                var startingY = _this.r.v[_this.getY(word)];
                var startingMemoryLocation = _this.r.i;
                for (var y = 0; y < numberOfBytes; y++) {
                    var byte = _this.ram[startingMemoryLocation + y];
                    for (var x = 0; x < 8; x++) {
                        // const bit: number = (byte >> (7 - x)) & 0x1;
                        // let xPos = startingX + x;
                        // let yPos = startingY + y;
                        // xPos = (xPos >= 64) ? xPos - 64 : xPos;
                        // yPos = (yPos >= 32) ? yPos - 32 : yPos;
                        // this.r.v[0xF] = (this.setPixel(xPos, yPos, !!bit)) ? 0x1 : 0x0;
                        if (((byte & (0x80 >> x)) !== 0)) {
                            var collision = (_this.setPixel(startingX + x, startingY + y));
                            // tslint:disable-next-line:no-console
                            if (collision) {
                                _this.r.v[0xF] = 1;
                            }
                        }
                    }
                }
                _this.r.pc += 2;
                if (_this.display) {
                    _this.display.draw(_this.graphicMemory);
                }
                if (_this.debugToolImpl) {
                    _this.debugToolImpl.onGeneralRegisterChange(_this.r.v);
                }
            };
        ops[0xE] =
            // E
            function (word) {
                var valueInRegisterX = _this.r.v[_this.getX(word)];
                var isKeyPressed = (_this.controller) ? _this.controller.isButtonPressed(valueInRegisterX) : false;
                switch (_this.getKK(word)) {
                    case 0x9E: // Skip next instruction if key is pressed
                        if (isKeyPressed) {
                            _this.r.pc += 2;
                        }
                        break;
                    case 0xA1: // Skip next instruction if key is not pressed
                        if (!isKeyPressed) {
                            _this.r.pc += 2;
                        }
                        break;
                }
                _this.r.pc += 2;
            };
        ops[0xF] =
            // F
            function (word) {
                var valueOfX = _this.getX(word);
                var valueInRegisterX = _this.r.v[valueOfX];
                switch (_this.getKK(word)) {
                    case 0x07: // Set Vx = delay timer
                        _this.r.v[valueOfX] = _this.r.delay;
                        if (_this.debugToolImpl) {
                            _this.debugToolImpl.onGeneralRegisterChange(_this.r.v);
                        }
                        break;
                    case 0x0A: // Wait for keypress, store value in Vx
                        var keyPressed = (_this.controller) ? _this.controller.getPressedButton() : undefined;
                        if (keyPressed) {
                            _this.r.v[valueOfX] = keyPressed;
                        }
                        else {
                            return;
                        }
                        break;
                    case 0x15: // Set delay timer = Vx
                        _this.r.delay = valueInRegisterX;
                        if (_this.debugToolImpl) {
                            _this.debugToolImpl.onSpecialRegisterChange(_this.r.i, _this.r.delay, _this.r.sound);
                        }
                        break;
                    case 0x18: // Set sound timer = Vx
                        _this.r.sound = valueInRegisterX;
                        if (_this.debugToolImpl) {
                            _this.debugToolImpl.onSpecialRegisterChange(_this.r.i, _this.r.delay, _this.r.sound);
                        }
                        break;
                    case 0x1E: // Set i = i + Vx
                        _this.r.i += valueInRegisterX;
                        if (_this.debugToolImpl) {
                            _this.debugToolImpl.onSpecialRegisterChange(_this.r.i, _this.r.delay, _this.r.sound);
                        }
                        break;
                    case 0x29: // Set I to the location of the sprite for the character in Vx
                        _this.r.i = valueInRegisterX * 0x5;
                        if (_this.debugToolImpl) {
                            _this.debugToolImpl.onSpecialRegisterChange(_this.r.i, _this.r.delay, _this.r.sound);
                        }
                        break;
                    case 0x33: // Store decimal value of Vx in memory locations i, i+1, i+2
                        _this.ram[_this.r.i] = valueInRegisterX / 100;
                        _this.ram[_this.r.i + 1] = (valueInRegisterX / 10) % 10;
                        _this.ram[_this.r.i + 2] = (valueInRegisterX % 100) % 10;
                        if (_this.debugToolImpl) {
                            _this.debugToolImpl.onRamChange(_this.ram);
                        }
                        break;
                    case 0x55: // Store register V0 through Vx in memory starting at location i
                        for (var location_1 = 0; location_1 <= valueOfX; location_1++) {
                            _this.ram[_this.r.i + location_1] = _this.r.v[location_1];
                        }
                        if (_this.debugToolImpl) {
                            _this.debugToolImpl.onRamChange(_this.ram);
                        }
                        break;
                    case 0x65: // Read registers V0 through Vx from memory starting at location i
                        for (var location_2 = 0; location_2 <= valueOfX; location_2++) {
                            _this.r.v[location_2] = _this.ram[_this.r.i + location_2];
                        }
                        if (_this.debugToolImpl) {
                            _this.debugToolImpl.onGeneralRegisterChange(_this.r.v);
                        }
                        break;
                }
                _this.r.pc += 2;
            };
        return ops;
    };
    Cpu.prototype.resetStates = function () {
        this.lastDelayTime = Date.now();
        this.graphicMemory = new Array(64 * 32);
        this.r.pc = 0x200;
        this.r.v = new Array(16);
        this.r.delay = 0;
        this.r.sound = 0;
        this.r.i = 0;
        this.r.sp = 0;
    };
    Cpu.prototype.buildMemory = function () {
        var ram = new Array(512 - this.font.length);
        ram.unshift.apply(ram, this.font);
        if (this.debugToolImpl) {
            this.debugToolImpl.onRamChange(this.ram);
        }
        return ram;
    };
    Cpu.prototype.getInstruction = function () {
        var firstByte = this.ram[this.r.pc];
        var secondByte = this.ram[this.r.pc + 1];
        return (firstByte << 8) ^ secondByte;
    };
    Cpu.prototype.setPixel = function (x, y) {
        var width = 64;
        var height = 32;
        // If the pixel exceeds the dimensions,
        // wrap it back around.
        if (x > width) {
            x -= width;
        }
        else if (x < 0) {
            x += width;
        }
        if (y > height) {
            y -= height;
        }
        else if (y < 0) {
            y += height;
        }
        var location = x + (width * y);
        var old = this.graphicMemory[location];
        this.graphicMemory[location] = this.graphicMemory[location] ? !true : true;
        return !this.graphicMemory[location];
    };
    Cpu.fpsInterval = 1000 / 603;
    return Cpu;
}());

var Controller = /** @class */ (function () {
    function Controller() {
        this.inputButtons = {
            1: {
                onController: 1,
                pressed: false,
            },
            2: {
                onController: 2,
                pressed: false,
            },
            3: {
                onController: 3,
                pressed: false,
            },
            4: {
                onController: 0xC,
                pressed: false,
            },
            q: {
                onController: 4,
                pressed: false,
            },
            w: {
                onController: 5,
                pressed: false,
            },
            // tslint:disable-next-line:object-literal-sort-keys
            e: {
                onController: 6,
                pressed: false,
            },
            r: {
                onController: 0xD,
                pressed: false,
            },
            a: {
                onController: 7,
                pressed: false,
            },
            s: {
                onController: 8,
                pressed: false,
            },
            d: {
                onController: 9,
                pressed: false,
            },
            f: {
                onController: 0xE,
                pressed: false,
            },
            z: {
                onController: 0xA,
                pressed: false,
            },
            x: {
                onController: 0,
                pressed: false,
            },
            c: {
                onController: 0xB,
                pressed: false,
            },
            v: {
                onController: 0xF,
                pressed: false,
            },
        };
    }
    Controller.prototype.getPressedButton = function () {
        var _this = this;
        var buttonsPressed = Object.keys(this.inputButtons)
            .map(function (key) { return _this.inputButtons[key]; })
            .filter(function (item) { return item.pressed; });
        if (buttonsPressed.length < 1) {
            return undefined;
        }
        return buttonsPressed[0].onController;
    };
    Controller.prototype.isButtonPressed = function (keyToCheck) {
        var _this = this;
        var match = Object.keys(this.inputButtons)
            .map(function (key) { return _this.inputButtons[key]; })
            .filter(function (item) { return item.onController === keyToCheck; });
        var result = match.every(function (item) { return item.pressed; });
        return result;
    };
    Controller.prototype.onKeyDown = function (event) {
        if (this.inputButtons.hasOwnProperty(event.key)) {
            this.inputButtons[event.key].pressed = true;
        }
    };
    Controller.prototype.onKeyUp = function (event) {
        if (this.inputButtons.hasOwnProperty(event.key)) {
            this.inputButtons[event.key].pressed = false;
        }
    };
    return Controller;
}());

var Display = /** @class */ (function () {
    function Display(size) {
        this.size = size;
        this.screenWidth = 64;
        this.canvas = document.getElementById("mainboard");
        this.canvasContext = this.canvas.getContext("2d");
    }
    Display.prototype.draw = function (gfxMemory) {
        this.canvasContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
        var blockSize = {
            x: this.canvas.width / this.size.x,
            y: this.canvas.height / this.size.y,
        };
        for (var y = 0; y < 32; y++) {
            for (var x = 0; x < this.screenWidth; x++) {
                this.canvasContext.beginPath();
                if (gfxMemory[(this.screenWidth * y) + x]) {
                    this.canvasContext.fillStyle = "#445564";
                    this.canvasContext.fillRect(x * blockSize.x, y * blockSize.y, blockSize.x, blockSize.y);
                }
                this.canvasContext.stroke();
                this.canvasContext.closePath();
            }
        }
    };
    return Display;
}());

var myWindow = window;
if (myWindow.File && myWindow.FileReader && myWindow.FileList && myWindow.Blob) {
    window.onload = function () {
        var controller = new Controller();
        var cpu = new Cpu(new Display({ x: 64, y: 32 }), /* new DebuggerTool()*/ undefined, controller);
        var stepButton = document.getElementById("step");
        var stopButton = document.getElementById("stop");
        var startButton = document.getElementById("start");
        var resetButton = document.getElementById("reset");
        var select = document.getElementById("program");
        var programLoaded = document.getElementById("loaded-program");
        document.addEventListener("keydown", function (event) {
            controller.onKeyDown(event);
            // alert("key" + event.key);
        });
        document.addEventListener("keyup", function (event) { return controller.onKeyUp(event); });
        var programs = ["15PUZZLE", "BLINKY", "BLITZ", "BRIX", "CONNECT4", "GUESS", "HIDDEN",
            "IBM", "INVADERS", "KALEID", "MAZE", "MERLIN", "MISSILE", "PONG", "PONG2", "PUZZLE", "SYZYGY",
            "TANK", "TETRIS", "TICTAC", "UFO", "VBRIX", "VERS", "WIPEOFF"];
        programs.forEach(function (program) {
            var option = document.createElement("option");
            option.textContent = program;
            select.add(option);
        });
        select.addEventListener("change", function (event) {
            var value = select.value;
            var xhr = new XMLHttpRequest();
            if (!value) {
                alert("Please select a ROM.");
                return;
            }
            // Load program.
            xhr.open("GET", "roms/" + value, true);
            xhr.responseType = "arraybuffer";
            xhr.onload = function () {
                cpu.loadRom(Array.from(new Uint8Array(xhr.response)));
                programLoaded.textContent = value;
            };
            xhr.send();
            this.blur();
        });
        if (stepButton) {
            stepButton.addEventListener("click", function () {
                if (cpu) {
                    cpu.step();
                }
            });
        }
        if (stopButton) {
            stopButton.addEventListener("click", function () {
                if (cpu) {
                    cpu.stop();
                }
            });
        }
        if (startButton) {
            startButton.addEventListener("click", function () {
                if (cpu) {
                    cpu.start();
                }
            });
        }
        if (resetButton) {
            resetButton.addEventListener("click", function () {
                if (cpu) {
                    cpu.reset();
                }
            });
        }
    };
}
