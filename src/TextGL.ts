import { GPU }  from 'gpu.js';

export namespace TextGL {
    export enum TextStyle {
        Reset = "\x1b[0m",
        Bright = "\x1b[1m",
        Dim = "\x1b[2m",
        Underscore = "\x1b[4m",
        Blink = "\x1b[5m",
        Reverse = "\x1b[7m",
        Hidden = "\x1b[8m",
    
        FgBlack = "\x1b[30m",
        FgRed = "\x1b[31m",
        FgGreen = "\x1b[32m",
        FgYellow = "\x1b[33m",
        FgBlue = "\x1b[34m",
        FgMagenta = "\x1b[35m",
        FgCyan = "\x1b[36m",
        FgWhite = "\x1b[37m",
    
        BgBlack = "\x1b[40m",
        BgRed = "\x1b[41m",
        BgGreen = "\x1b[42m",
        BgYellow = "\x1b[43m",
        BgBlue = "\x1b[44m",
        BgMagenta = "\x1b[45m",
        BgCyan = "\x1b[46m",
        BgWhite = "\x1b[47m",
    }
    export type RenderingOptions = {
        GPUAcceleration: boolean;
    }
    export type Text2D = string[][];
    export type Matrix = number[][];
    export type Point2D = {x: number; y: number;};

    export type TokenizedText2DData = {
        tokenData: Record<number, string>;
        matrix: Matrix
    }
    export function applyStyle(text: string, style: TextStyle){
        return `${style}${text}${TextStyle.Reset}`;
    }
    export function applyStyles(text: string, styles: TextStyle[]){
        return styles.reduce((acc, curr, i) => {
            return applyStyle(acc, curr);
        }, text)
    }
    export function tokenizeText2D(text: Text2D): TokenizedText2DData {
        const matrix = text.map(line => line.map(t => {
            return t.charCodeAt(0)
        }));
        return {
            tokenData: {},
            matrix
        };
    }
    export function unTokenize(token: number) {
        return String.fromCharCode(token);
    }
    export function clear(){
        console.clear();
    }
    export class Renderable {
        public x: number = 0;
        public y: number = 0;
        public hide: boolean = false; // 임시
        private static *generateID(){
            let id = 0;
            for(;;) yield ++id;
        }
        static IDGenerator = Renderable.generateID();
        public readonly id: number = Renderable.IDGenerator.next().value!;
        constructor(public texture: Texture){}

        translate({x, y}: Partial<{x: number, y: number}>){
            this.x = x || this.x;
            this.y = y || this.y;
        }
        update(){}

    }
    /**
     * Note: please do not use GPUAcceleration option (unstable)
     */
    export class Renderer {
        private display: Display;
        private renderables: Map<number, Renderable> = new Map();
        private GPUAcceleration: boolean;

        static GPU = new GPU();

        constructor(options: {
            ups: number;
            width: number;
            height: number;
            GPUAcceleration: boolean;
        }){

            this.GPUAcceleration = options.GPUAcceleration;
            const body = [];
            for(let i=0; i<options.height; i++){
                const row = [];
                for(let j=0; j<options.width; j++){
                    row.push(" ")
                }
                body.push(row)
            }
            this.display = new Display(body);
            setInterval(() => {
                clear()
                this.update()
                this.render()
            }, options.ups)
        }
        private update(){
            this.renderables.forEach(renderable => {
                renderable.update()
            })
        }
        private render(){
            if(this.GPUAcceleration){
                this.display.preProcessing(this.renderables)
                this.display.GPUPreRender()
            }
            else this.display.CPUPreRender(this.renderables)
            this.display.render()
        }
        addRenderable(renderable: Renderable){
            this.renderables.set(renderable.id, renderable)
        }
        removeRenderableByID(id: number){
            this.renderables.delete(id)
        }
        removeRenderable(renderable: Renderable){
            this.renderables.delete(renderable.id)
        }
        addRenderables(renderables: Renderable[]){
            for(const renderable of renderables){
                this.renderables.set(renderable.id, renderable)
            }
        }
    }
    export class Texture {
        constructor(private model: Text2D){}
        tokenize(){
            // 토큰 객체 반환
            // {"a": 0, "b": 1 ...}가 tokenData (메타데이터), matrix가 실제 data
            // 최초1 회 후 포스트 프로세싱 제외하면 재호출 없도록 최적화. 텍스쳐 크기가 방대해짐에 대비하여 GPU 가속 고려
            return tokenizeText2D(this.model);
        }
        applyShader(shader: Shader){
            this.model = this.model.map(texts => texts.map(text => shader.apply(text)));
            return this;
        }
        get tex(){
            return this.model;
        }
    }
    export class Display {
        private preRenderingTexture: TokenizedText2DData;
        private initialText: Text2D;
        constructor(private baseText: Text2D){
            this.initialText = baseText;
            this.preRenderingTexture = tokenizeText2D(this.baseText);
        }
        preProcessing(renderableMap: Map<number, Renderable>){ //ONLY for GPU acceleration
            this.preRenderingTexture = tokenizeText2D(this.baseText);
            const compositeProcess = Renderer.GPU.createKernel(
                function(texture: Matrix, renderableTex: Matrix, position: number[], length: number[][]){
                    if(
                        this.thread.x >= position[0] && 
                        this.thread.x <= length[1][0] * position[0] && 
                        this.thread.y <= length[1][1] * position[1] && 
                        this.thread.y >= position[1]
                    ){
                        const y = this.thread.y - position[1]
                        const x = this.thread.x - position[0]
                        return renderableTex[y][x];
                    } else {
                        return texture[this.thread.y][this.thread.x];
                    }
                }, { 
                    output: [ this.preRenderingTexture.matrix[0].length, this.preRenderingTexture.matrix.length ] 
                }
            );
            renderableMap.forEach(renderable => {
                const tokenizedTexture = tokenizeText2D(renderable.texture.tex);

                this.preRenderingTexture.matrix = compositeProcess(
                    this.preRenderingTexture.matrix, 
                    tokenizedTexture.matrix, 
                    [ renderable.x, renderable.y ], 
                    [
                        [ this.preRenderingTexture.matrix[0].length, this.preRenderingTexture.matrix.length ],
                        [ tokenizedTexture.matrix[0].length, tokenizedTexture.matrix.length ]
                    ]
                ) as Matrix;
            })
        }
        //더 최적화할 방안 없나? render하고 합쳐서 반복 1타임 더 줄이도록 해보자.
        GPUPreRender(){
            this.baseText = this.preRenderingTexture.matrix.map(tokens => tokens.map(unTokenize));
        }
        CPUPreRender(renderableMap: Map<number, Renderable>){ 
            this.baseText = this.initialText;
            renderableMap.forEach(renderable => {
                let buffer = this.baseText;
                renderable.texture.tex.forEach((line, y) => {
                    line.forEach((text, x) => {
                        if(buffer[y + renderable.y] && buffer[y + renderable.y][x + renderable.x]) {
                            buffer[y + renderable.y][x + renderable.x] = text;
                        }
                    })
                })
                this.baseText = buffer;
            })
        }
        render(){
            this.baseText.forEach(line => {
                console.log(line.join(""))
            })
        }
    }
    export class Shader {
        constructor(private fragments: Record<string, TextStyle[]>){}
        apply(text: string){
            if(!this.fragments[text]) return text;
            return applyStyles(text, this.fragments[text]);
        }
    }
}
