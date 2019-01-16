import Cpu, { IDebugTool } from "../Cpu";
import Controller from "./Controller";
import Display from "./Display";

// tslint:disable:no-console
class DebuggerTool implements IDebugTool {

    public onRamChange(ram: number[]) {
        // todo
    }

    public onGeneralRegisterChange(registers: number[]) {
        const registerTable: HTMLElement = (document.getElementById("registerTable") as HTMLElement);
        let htmlString: string = "<tr><th>Vx</th><th></th></tr>";
        for (const index in registers) {
            if (registers.hasOwnProperty(index)) {
                const element: number = registers[index];
                htmlString += `<tr><td>${index}</td><td>0x${element.toString(16)} (${element})</td></tr>`;
            }
        }
        registerTable.innerHTML = htmlString;
    }

    public onSpecialRegisterChange(i: number, delay: number, sound: number) {
        (document.getElementById("regI") as HTMLElement).innerHTML = `0x${i.toString(16)} (${i})`;
        (document.getElementById("delay") as HTMLElement).innerHTML = `0x${delay.toString(16)} (${delay})`;
        (document.getElementById("sound") as HTMLElement).innerHTML = `0x${sound.toString(16)} (${sound})`;
    }

    public onStackChange(stack: number[], stackPointer: number) {
        const stackTable: HTMLElement = (document.getElementById("stackTable") as HTMLElement);
        stackTable.innerHTML = "<tr><th>Stack Pointer</th><th>Stack</th></tr>"; // header
        stackTable.innerHTML += `<tr><td>${stackPointer}</td></tr>`;
        for (let i = stackPointer - 1; i >= 0; i--) {
            stackTable.innerHTML += `<tr><td></td><td>0x${stack[i].toString(16)} (${stack[i]})</td></tr>`;
        }
    }

    public onStep(programCounter: number, word: number, nextWord: number) {
        (document.getElementById("pc") as HTMLElement)
            .innerHTML = `0x${programCounter.toString(16)} (${programCounter})`;
        (document.getElementById("word") as HTMLElement).innerHTML = `0x${word.toString(16)} (${word})`;
        (document.getElementById("nextWord") as HTMLElement).innerHTML = `0x${nextWord.toString(16)} (${nextWord})`;
    }
}

const myWindow: any = window;
if (myWindow.File && myWindow.FileReader && myWindow.FileList && myWindow.Blob) {
    window.onload = () => {
        const controller: Controller = new Controller();
        const cpu: Cpu = new Cpu(new Display({ x: 64, y: 32 }), /* new DebuggerTool()*/undefined, controller);
        const stepButton: HTMLButtonElement = document.getElementById("step") as HTMLButtonElement;
        const stopButton: HTMLButtonElement = document.getElementById("stop") as HTMLButtonElement;
        const startButton: HTMLButtonElement = document.getElementById("start") as HTMLButtonElement;
        const resetButton: HTMLButtonElement = document.getElementById("reset") as HTMLButtonElement;
        const select: HTMLSelectElement = document.getElementById("program") as HTMLSelectElement;
        const programLoaded: HTMLDataElement = document.getElementById("loaded-program") as HTMLDataElement;

        document.addEventListener("keydown", (event) => {
            controller.onKeyDown(event);
            // alert("key" + event.key);
        });
        document.addEventListener("keyup", (event) => controller.onKeyUp(event));

        const programs = ["15PUZZLE", "BLINKY", "BLITZ", "BRIX", "CONNECT4", "GUESS", "HIDDEN",
            "IBM", "INVADERS", "KALEID", "MAZE", "MERLIN", "MISSILE", "PONG", "PONG2", "PUZZLE", "SYZYGY",
            "TANK", "TETRIS", "TICTAC", "UFO", "VBRIX", "VERS", "WIPEOFF"];
        programs.forEach((program) => {
            const option = document.createElement("option");
            option.textContent = program;
            select.add(option);
        });
        select.addEventListener("change", function(event) {
            const value = select.value;
            const xhr = new XMLHttpRequest();

            if (!value) {
                alert("Please select a ROM.");
                return;
            }
            // Load program.
            xhr.open("GET", "roms/" + value, true);
            xhr.responseType = "arraybuffer";
            xhr.onload = () => {
                cpu.loadRom(Array.from(new Uint8Array(xhr.response)));
                programLoaded.textContent = value;
            };
            xhr.send();

            this.blur();
        });

        if (stepButton) {
            stepButton.addEventListener("click", () => {
                if (cpu) {
                    cpu.step();
                }
            });
        }
        if (stopButton) {
            stopButton.addEventListener("click", () => {
                if (cpu) {
                    cpu.stop();
                }
            });
        }
        if (startButton) {
            startButton.addEventListener("click", () => {
                if (cpu) {
                    cpu.start();
                }
            });
        }
        if (resetButton) {
            resetButton.addEventListener("click", () => {
                if (cpu) {
                    cpu.reset();
                }
            });
        }
    };
}
