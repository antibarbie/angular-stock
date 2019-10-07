/// Complete definition of a command
export class Command {
    id: number;
    date: string;
    ref: string;
    qty: number;
    expected: boolean;


    constructor(ref: string = '', qty: number = 1, expected: boolean = false, date: string = undefined, id: number = undefined){
        this.ref = ref;
        this.qty = qty;
        this.expected = expected;
        this.date = date;
        this.id = id;        
    }
}