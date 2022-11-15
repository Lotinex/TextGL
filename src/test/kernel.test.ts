import { GPU }  from 'gpu.js';


const G = new GPU();


let arr = [
    [1, 0, 1], 
    [1, 0, 1], 
    [1, 0, 1], 
    [1, 0, 1]
]

let p = [
    [4, 5],
    [6, 7]
];

const X = G.createKernel(function($arr: number[][], target: number[][], pos: number[], $length: number[][]){
    if(
        this.thread.x >= pos[0] && 
        this.thread.x <= $length[1][0] * pos[0] && 
        this.thread.y <= $length[1][1] * pos[1] && 
        this.thread.y >= pos[1]
    ){
        const y = this.thread.y - pos[1]
        const x = this.thread.x - pos[0]
        return target[y][x]
    } else {
        return $arr[this.thread.y][this.thread.x];
    }
}, { output: [ arr[0].length, arr.length ]})


arr = X(arr, p, [1, 1], [
    [arr[0].length, arr.length], //x, y
    [p[0].length, p.length]
]) as any;

console.log(arr)    