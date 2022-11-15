import * as ReadLine from 'readline';

import { TextGL } from './TextGL';

import GPU from 'gpu.js';

enum Events {
    OPEN_INVENTORY,
    WARP,
    ATTACK,
    USE_ITEM,
    THROW_ITEM,
    MODE_DEF
}
type EventData = {
    listener: (content: string) => void;
    prefix: string;
}
class StateManager {

}
class InputManager<T extends number> {
    private events: Partial<Record<T, EventData>> = {};
    private currentEvents: Array<T> = [];
    private _interface: ReadLine.Interface = ReadLine.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    constructor(){
        this._interface.on('line', line => {
            for(const event in this.events){
                const targetEvent = this.events[event]!;
                if(this.currentEvents.includes(Number(event) as T) && line.startsWith(targetEvent!.prefix)) {
                    targetEvent.listener(
                        line.replace(new RegExp(`^(${targetEvent.prefix})`), "")
                    )
                }
            }
        })
    }
    allowEvent(event: T){
        this.currentEvents.push(event)
    }
    preventEvent(event: T){
        this.currentEvents = this.currentEvents.filter(eventName => eventName !== event);
    }
    isAllowed(event: T){
        return this.currentEvents.includes(event);
    }
    on(event: T, prefix: string, listener: (content: string) => void){
        this.events[event] = {
            prefix,
            listener
        };
    }
}
class KeyEventManager {
    private keyTable: Record<string, () => void> = {};
    constructor(){
        ReadLine.emitKeypressEvents(process.stdin)
        if(process.stdin.isTTY) process.stdin.setRawMode(true)
        process.stdin.on('keypress', (_, key) => {
            for(const currentKey in this.keyTable){
                if(key.name == currentKey) this.keyTable[currentKey]()
            }
        })
    }
    onKeypress(key: string, listener: () => void){
        this.keyTable[key] = listener;
    }
}

class GameMap extends TextGL.Renderable {
    private static shader = new TextGL.Shader({
        "|": [TextGL.TextStyle.BgBlack, TextGL.TextStyle.FgRed],
        "▒": [TextGL.TextStyle.FgGreen]
    });
    static wallMap: true[][] = [];
    constructor(){

        const texture = new TextGL.Texture([
            ["|", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "|"],
            ["|", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "|"],
            ["|", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "|"],
            ["|", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "|"],
            ["|", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "|"],
            ["|", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "|"],
            ["|", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "▒", "|"]
        ]).applyShader(GameMap.shader);

        super(texture)
    }
    override update(){
        
    }
}
class Alert extends TextGL.Renderable {
    constructor(content: string){
        const texture = new TextGL.Texture([])
        super(texture)
    }
}
class Player extends TextGL.Renderable {
    private static shader = new TextGL.Shader({
        "■": [TextGL.TextStyle.FgBlue]
    });
    private static checkWallExists(pos: TextGL.Point2D){
        return GameMap.wallMap[pos.y] && GameMap.wallMap[pos.y][pos.x];
    }
    static alertText: Alert = new Alert("");
    private static alertWallExists(){
        Player.alertText.texture = new TextGL.Texture([
            [" ", " ", "┌", ..."─".repeat(61).split(""), "┐"],
            [..."──┤ 🟫 흙더미 x 1: 커다란 흙더미. 가로질러 지나갈 수 없다.  ".split(""), "   │"],
            [" ", " ", "└", ..."─".repeat(61).split(""), "┘"]
        ]).applyShader(
            new TextGL.Shader({
                "[": [TextGL.TextStyle.FgRed],
                "!": [TextGL.TextStyle.FgRed],
                "]": [TextGL.TextStyle.FgRed],
                "x": [TextGL.TextStyle.FgYellow],
                "1": [TextGL.TextStyle.FgYellow]
            })
        );
        Player.alertText.translate({
            x: 23,
            y: 3
        })

    }
    constructor(){
        const texture = new TextGL.Texture([
            ["■"]
        ]).applyShader(Player.shader);

        super(texture)

        const keyboard = new KeyEventManager();
        keyboard.onKeypress('a', () => {
            KeyUI.keyState.A = true;
            keys.activeKey()
            const pos = {
                x: this.x - 1,
                y: this.y
            };
            if(Player.checkWallExists(pos)) {
                Player.alertWallExists();
                return;
            }
            this.translate(pos)
        })
        keyboard.onKeypress('s', () => {
            KeyUI.keyState.S = true;
            keys.activeKey()
            const pos = {
                x: this.x,
                y: this.y + 1
            };
            if(Player.checkWallExists(pos)) {
                return Player.alertWallExists();
            }
            this.translate(pos)
        })
        keyboard.onKeypress('d', () => {
            KeyUI.keyState.D = true;
            keys.activeKey()
            const pos = {
                x: this.x + 1,
                y: this.y
            };
            if(Player.checkWallExists(pos)) return Player.alertWallExists();
            this.translate(pos)
        })
        keyboard.onKeypress('w', () => {
            console.log(1)
            KeyUI.keyState.W = true;
            keys.activeKey()
            const pos = {
                x: this.x,
                y: this.y - 1
            };
            if(Player.checkWallExists(pos)) return Player.alertWallExists();
            this.translate(pos)
        })
        keyboard.onKeypress('p', () => {
            process.exit(0)
        })


        setInterval(() => {
            let k: "W" | "S" | "A" | "D";
            for(k in KeyUI.keyState){
                KeyUI.keyState[k] = false;
            }
        }, 300)

    }
    update(): void {
        keys.activeKey()
    }
}
class KeyUI extends TextGL.Renderable {
    private static shader = new TextGL.Shader({
        "W": [TextGL.TextStyle.FgWhite],
        "A": [TextGL.TextStyle.FgWhite],
        "S": [TextGL.TextStyle.FgWhite],
        "D": [TextGL.TextStyle.FgWhite],
    });
    static keyState: Record<"W" | "A" | "S" | "D", boolean> = {
        "W": false,
        "A": false,
        "S": false,
        "D": false
    };
    constructor(){
        const texture = new TextGL.Texture([
            [" ", "W", " "],
            ["A", "S", "D"],
        ]).applyShader(KeyUI.shader);

        super(texture)

        this.translate({
            x: 9,
            y: 8
        })
    }
    activeKey(){
        const current: Partial<Record<"W" | "A" | "S" | "D", TextGL.TextStyle[]>>  = {};
        let k: "W" | "A" | "S" | "D";
        for(k in KeyUI.keyState){
            if(KeyUI.keyState[k]) current[k] = [TextGL.TextStyle.FgCyan];
        }
        this.texture = new TextGL.Texture([
            [" ", "W", " "],
            ["A", "S", "D"],
        ]).applyShader(new TextGL.Shader(current));
    }
}
class Wall extends TextGL.Renderable {
    private static shader = new TextGL.Shader({
        "▧": [TextGL.TextStyle.FgRed]
    });
    constructor(position: TextGL.Point2D){

        const texture = new TextGL.Texture([
            ["▧"]
        ]).applyShader(Wall.shader);

        super(texture)

        if(GameMap.wallMap[position.y]) GameMap.wallMap[position.y][position.x] = true;
        else {
            GameMap.wallMap[position.y] = [];
            GameMap.wallMap[position.y][position.x] = true;
        }

        this.translate(position)
    }
}


const screen = new TextGL.Renderer({
    ups: 10,
    width: 100,
    height: 15,
    GPUAcceleration: false
});

const map = new GameMap();
const player = new Player();
screen.addRenderable(Player.alertText)
const keys = new KeyUI();


screen.addRenderable(map)
screen.addRenderables([
    new Wall({x: 2, y: 3}),
    new Wall({x: 10, y: 6}),
    new Wall({x: 1, y: 5}),
    new Wall({x: 10, y: 1}),
    new Wall({x: 3, y: 2})
])
screen.addRenderable(player)
screen.addRenderable(keys)


