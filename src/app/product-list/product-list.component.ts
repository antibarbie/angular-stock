import { Component, OnInit } from '@angular/core';
import { Product } from '../model/product';
import { ProductService } from '../product.service';
import { Observable } from 'rxjs';
import { FormControl, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit {

  searchGroup: FormGroup;

  productlimit : number = 100;
  product$ : Observable<Product[]>;
  productOffset : number;
  searchValue : string;

  constructor(private productService: ProductService) {
    this.productOffset = 0;
    this.searchValue = '';    

    this.searchGroup = new FormGroup({
      name: new FormControl(''),// [ Validators.required, Validators.minLength(2)], this.checkPonyNameAvailable.bind(this)),
     // img: new FormControl('')//, [ Validators.required, Validators.minLength(2), this.gifRequired])
    });
   }

   searchAgain() {
    this.product$ = this.productService.getProducts(this.searchValue,this.productlimit, this.productOffset);
   }

  ngOnInit() {
    this.searchAgain();
    
    // Changes searchvalue when input changes..
    this.searchGroup.get('name').valueChanges.subscribe(val => {
      this.searchValue = val;
      this.searchAgain();
    });
  }

  onNextClick() {
    this.productOffset += this.productlimit;
    this.searchAgain();
  }

  onPrevClick() {
    this.productOffset = Math.max(0, this.productOffset - this.productlimit);
    this.searchAgain();
  }
}
