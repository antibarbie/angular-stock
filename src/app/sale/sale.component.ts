import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { Product } from '../model/product';
import { ProductService } from '../product.service';
import * as moment from 'moment';
import {switchMap, debounceTime} from 'rxjs/operators';
import { Sale } from '../model/sale';
import { SaleService } from '../sale.service';

@Component({
  selector: 'app-sale',
  templateUrl: './sale.component.html',
  styleUrls: ['./sale.component.scss']
})
export class SaleComponent implements OnInit {

  saleGroup: FormGroup;

  salelimit : number = 100;

  sales$ : Observable<Sale[]>;

  filteredProducts$ : Observable<Product[]>;

  offset : number;

  constructor(private productService: ProductService, private saleService: SaleService ) {
    this.offset = 0;

    this.saleGroup = new FormGroup({
      ref: new FormControl('', [ Validators.required, Validators.minLength(2)] ),// this.checkProductExists.bind(this)),
      qty: new FormControl('1', [ Validators.required, Validators.min(1)]),
      //pht: new FormControl('0.00', [ Validators.required ]),
      pttc: new FormControl('0.00', [ Validators.required ])
    });
   }

   // Default values for "new" form
   resetForm() {
    this.saleGroup.get('ref').setValue('');
    this.saleGroup.get('qty').setValue('1');
    //this.saleGroup.get('pht').setValue('0.00');
    this.saleGroup.get('pttc').setValue('');
    this.saleGroup.markAsPristine();
    this.saleGroup.markAsUntouched();
   }

   // updates search results
   searchAgain() {
    this.sales$ = this.saleService.getSales(this.salelimit, this.offset);

    this.resetForm();
   }

  ngOnInit() {
    this.searchAgain();

    // Auto-complete !
    this.filteredProducts$ = this.saleGroup.get('ref')
      .valueChanges
      .pipe(
        debounceTime(300),
        switchMap(value => this.productService.getProducts(value, 10, 0) /* get 10 values max */)
      );
  }

  // Checks that the product really exists !
  checkProductExists(control : FormControl) {
    return undefined;
  }

  /// Click new sale
  onSubmitSale() {
    var cmdAuto = this.saleGroup.value as Sale;
    cmdAuto.date = moment(new Date()).format("YYYY-MM-DD");
    cmdAuto.id = undefined;
    var price_txt = this.saleGroup.get('pttc').value;
    price_txt = price_txt.replace(',','.'); // hack french separator
    cmdAuto.pttc = + price_txt;
    cmdAuto.pttc = Math.round(((cmdAuto.pttc) + 0.00001) * 100) / 100;
    cmdAuto.pht = Math.round(((cmdAuto.pttc / 1.2) + 0.00001) * 100) / 100;
    console.log("Submit sale :");
    console.log(cmdAuto);

    this.saleService.addSale(cmdAuto).subscribe( () => {
      this.searchAgain();
    });
  }

  // Next in list
  onNextClick() {
    this.offset += this.salelimit;
    this.searchAgain();
  }

  // Previous in list
  onPrevClick() {
    this.offset = Math.max(0, this.offset - this.salelimit);
    this.searchAgain();
  }

  // Cancel a sale we miss-typed
  onCancelSale(sale : Sale)
  {
    console.log("Deleting sale :"+sale.id);
    this.saleService.removeSale(sale.id).subscribe(() => {
      this.searchAgain();
    });
  }



}
