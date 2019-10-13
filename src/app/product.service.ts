import { Injectable } from '@angular/core';
import {Product} from '../app/model/product';
import {HttpClient, HttpParams} from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, debounceTime, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { FormControl, ValidationErrors } from '@angular/forms';

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  constructor(private http: HttpClient) { }

  // Partial search 
  //getProductsByRef(name: string, limit: number) : Observable<Product[]> {
  //  return this.http.get<Product[]>(`${environment.apiUrl}/produit`,  { params: { id_like: name, _limit: ''+limit }});
  //}

  // Complete product list
  getProducts(name: string, limit: number, offset: number) : Observable<Product[]> {
    return this.http.get<Product[]>(`${environment.apiUrl}/produit`,  { params: { id_like: name, _limit: ''+limit, _start: ''+offset }});
  }

  // One exact product
  getProduct(name: string) : Observable<Product> {
    return this.http.get<Product>(`${environment.apiUrl}/produit/${name}`).pipe(catchError((err) => {
      // simple logging, but you can do a lot more, see below
      return of(null as Product);
    }));
  }

  // Checks that the product really exists !
  checkProductExists(control : FormControl) : Observable<ValidationErrors>  {
    let ref = control.value as string;
    if (ref && ref.length >= 2) {
      return this.getProduct(ref)
      .pipe(
        debounceTime(300),
        map(product => {
          return product ? null : ({ unknownproduct: true });
        }) 
      );
    }
    return of({unknownproduct: true});
  }
  
}
