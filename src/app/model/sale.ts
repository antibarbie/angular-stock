/// Complete definition of a Sale
export class Sale {
    id: number;
    date: string;
    ref: string;
    qty: number;
    pht: number;
    pttc: number;

    constructor(ref: string = '', qty: number = 1, pht: number = 0, pttc: number = 0, date: string = undefined, id: number = undefined){
        this.ref = ref;
        this.qty = qty;
        this.pht = pht;
        this.pttc = pttc;
        this.date = date;
        this.id = id;        
    }
}