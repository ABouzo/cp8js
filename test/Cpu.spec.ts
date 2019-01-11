import * as chai from "chai";
import * as mocha from "mocha";
import Cpu, { IDebugTool } from "../src/Cpu";

const expect = chai.expect;

let cpu: Cpu = new Cpu(undefined, undefined, undefined);

// tslint:disable:object-literal-sort-keys
const debugTool = {
    vx: [0],
    ram: [0],
    I: 0,
    delay: 0,
    sound: 0,
    stack: [0],
    stackPointer: 0,
    pc: 0,
    word: 0,
    nextWord: 0,
    onGeneralRegisterChange: (Vx: number[]) => {
        debugTool.vx = Vx;
    },
    onRamChange: (ram: number[]) => debugTool.ram = ram,
    onSpecialRegisterChange: (I: number, delay: number, sound: number) => {
        debugTool.I = I;
        debugTool.delay = delay;
        debugTool.sound = sound;
    },
    onStackChange: (stack: number[], stackPointer: number) => {
        debugTool.stack = stack;
        debugTool.stackPointer = stackPointer;
    },
    onStep: (pc: number, word: number, nextWord: number) => {
        debugTool.pc = pc;
        debugTool.word = word;
        debugTool.nextWord = nextWord;
    },
    reset: () => {
        debugTool.vx = [0];
        debugTool.ram = [0];
        debugTool.I = 0;
        debugTool.delay = 0;
        debugTool.sound = 0;
        debugTool.stack = [0];
        debugTool.stackPointer = 0;
        debugTool.pc = 0;
        debugTool.word = 0;
        debugTool.nextWord = 0;
    },
};

// tslint:disable:no-unused-expression
describe("Chip 8 cpu", () => {

    beforeEach(() => {
        cpu = new Cpu(undefined, debugTool, undefined);
        debugTool.reset();
    });

    it("Should have V[0xF] set to 1 on collision", () => {
        cpu.loadRom([
            0xA2, 0x0A, // Location of sprite
            0x61, 0x00,
            0xd1, 0x11, // One byte drawn at 0,0
            0xA2, 0x0B,
            0xd1, 0x11, // ditto ^
            0xff, 0x40, // a black line
        ]);
        for (let i = 0; i < 5; i++) {
            // tslint:disable-next-line:no-console
            console.log(`-------------------------------------

            `);
            cpu.step();

            // tslint:disable-next-line:no-console
            console.log(`0x${debugTool.pc.toString(16)}
${debugTool.word.toString(16)} 0x${debugTool.nextWord.toString(16)}`);
            // tslint:disable-next-line:no-console
            console.log(`I=0x${debugTool.I.toString(16)}`);
            // tslint:disable-next-line:no-console
            console.log(`V0xF=0x${debugTool.vx[0xf]}`);
        }
        expect(debugTool.vx[0xF]).to.equal(1);
    });
});
