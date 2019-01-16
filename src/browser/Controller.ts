import { IController } from "../Cpu";

interface IKey {
    onController: number;
    pressed: boolean;
}

export default class Controller implements IController {

    public readonly inputButtons: { [key: string]: IKey };

    constructor() {
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

    public getPressedButton(): number | undefined {
        const buttonsPressed: IKey[] = Object.keys(this.inputButtons)
            .map((key) => this.inputButtons[key])
            .filter((item: any) => item.pressed);
        if (buttonsPressed.length < 1) {
            return undefined;
        }
        return buttonsPressed[0].onController;
    }

    public isButtonPressed(keyToCheck: number): boolean {
        const match = Object.keys(this.inputButtons)
            .map((key) => this.inputButtons[key])
            .filter((item: any) => item.onController === keyToCheck);
        const result = match.every((item: any) => item.pressed);
        return result;
    }

    public onKeyDown(event: KeyboardEvent) {
        if (this.inputButtons.hasOwnProperty(event.key)) {
            this.inputButtons[event.key].pressed = true;
        }
    }

    public onKeyUp(event: KeyboardEvent) {
        if (this.inputButtons.hasOwnProperty(event.key)) {
            this.inputButtons[event.key].pressed = false;
        }
    }
}
