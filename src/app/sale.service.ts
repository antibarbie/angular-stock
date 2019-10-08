import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Sale } from './model/sale';
import { environment } from 'src/environments/environment';
import { Observable,  } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SaleService {
  constructor(private http: HttpClient) { }

  // Completed old command list
  getSales(limit: number, offset: number) : Observable<Sale[]> {
    return this.http.get<Sale[]>(`${environment.apiUrl}/vente`,  
    { params: { _sort:'date', _order:'desc',  _limit: ''+limit, _start: ''+offset }});
  }


  // Gets one specific command by key
  getSaleById(id: number) : Observable<Sale> {
    return this.http.get<Sale>(`${environment.apiUrl}/vente`, { params: { id: ''+id }});
  }

  /// Adds a new a command
  addSale(sale: Sale ) : Observable<void> {
    console.log(`Posting to ${environment.apiUrl}/vente ...`);
    console.log(sale);
    
    return this.http.post<Sale>(
      `${environment.apiUrl}/vente`,  
      sale
    ).pipe(map(()=>{ 
      console.log("Posted ok.")
    }));
  }

  /// Changes a sale
  modifySale(cmd: Sale ) : Observable<void> {
    return this.http.put<Sale>(
      `${environment.apiUrl}/vente/${cmd.id}`,
      cmd
    ).pipe(map(()=>{ 
      console.log("Modified ok.")
    }));
  }

  /// Remove a sale
  removeSale(id: number ) : Observable<void> {
    return this.http.delete<Sale>(
      `${environment.apiUrl}/vente/${id}`).pipe(map(()=>{ 
        console.log("Deleted ok.")
      }));
  }
}
