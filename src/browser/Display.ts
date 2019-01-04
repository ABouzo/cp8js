import { IDisplay } from "../Cpu";

export interface IDimensions {
    readonly x: number;
    readonly y: number;
}

export default class Display implements IDisplay {
    private readonly screenWidth = 64;
    private readonly canvas: any;
    private readonly canvasContext: any;

    constructor(readonly size: IDimensions) {
        this.canvas = document.getElementById("mainboard");
        this.canvasContext = this.canvas.getContext("2d");
    }

    public draw(gfxMemory: boolean[]): void {
        this.canvasContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const blockSize: IDimensions = {
            x: this.canvas.width / this.size.x,
            y: this.canvas.height / this.size.y,
        };

        for (let y = 0; y < 32; y++) {
            for (let x = 0; x < this.screenWidth; x++) {

                this.canvasContext.beginPath();
                if (gfxMemory[(this.screenWidth * y) + x]) {
                    this.canvasContext.fillStyle = "#445564";
                    this.canvasContext.fillRect(
                        x * blockSize.x, y * blockSize.y,
                        blockSize.x, blockSize.y);
                }
                this.canvasContext.stroke();
                this.canvasContext.closePath();
            }
        }
    }

}
