import { Injectable } from '@angular/core';
import {Product} from '../app/model/product';
import {HttpClient, HttpParams} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

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
    return this.http.get<Product>(`${environment.apiUrl}/produit`,  { params: { id: name }});
  }

}
