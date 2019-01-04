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
        const cpu: Cpu = new Cpu(new Display({ x: 64, y: 32 }), new DebuggerTool(), controller);
        const fileInput: HTMLInputElement = document.getElementById("fileInput") as HTMLInputElement;
        const stepButton: HTMLButtonElement = document.getElementById("step") as HTMLButtonElement;

        document.addEventListener("keydown", (event) => {
            controller.onKeyDown(event);
            // alert("key" + event.key);
        });
        document.addEventListener("keyup", (event) => controller.onKeyUp(event));

        if (fileInput != null) {
            fileInput.addEventListener("change", (e) => {
                const fileList: FileList | null = fileInput.files;
                if (fileList != null) {
                    const file: File = fileList[0];

                    const reader = new FileReader();

                    reader.onload = () => {
                        if (reader.result != null) {
                            const romByteArray = new Uint8Array(reader.result as ArrayBuffer);
                            cpu.loadRom(Array.from(romByteArray));
                            cpu.start();
                        }
                    };

                    reader.readAsArrayBuffer(file);
                }
            });
        }
        if (stepButton) {
            stepButton.addEventListener("click", () => {
                if (cpu) {
                    cpu.step();
                }
            });
        }
    };
}
