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
            0xA2, 0x03, // Location of sprite
            0xd0, 0x01, // One byte drawn at 0,0
            0xd0, 0x01, // ditto ^
            0xff, 0xff, // a black line
        ]);
        for (let i = 0; i < 4; i++) {
            cpu.step();
        }
        expect(debugTool.vx[0xF]).to.equal(1);
    });
});
