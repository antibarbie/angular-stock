import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Command } from './model/command';
import { environment } from 'src/environments/environment';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class CommandService {

  constructor(private http: HttpClient) { }

  // Completed old command list
  getOldCommands(limit: number, offset: number) : Observable<Command[]> {
    return this.http.get<Command[]>(`${environment.apiUrl}/command`,  
    { params: { expected: 'false', _sort:'date', _order:'desc',  _limit: ''+limit, _start: ''+offset }});
  }

  // Un-Completed command list
  getCurrentCommands(limit: number) : Observable<Command[]> {
    return this.http.get<Command[]>(`${environment.apiUrl}/command`,  
    { params: { expected: 'true', _sort:'date', _order:'desc',  _limit: ''+limit }});
  }

  // Gets one specific command by key
  getCommandById(id: number) : Observable<Command> {
    return this.http.get<Command>(`${environment.apiUrl}/command`, { params: { id: ''+id }});
  }

  /// Adds a new a command
  addCommand(cmd: Command ) : Observable<void> {
    console.log(`Posting to ${environment.apiUrl}/command ...`);
    console.log(cmd);

    return this.http.post<Command>(
      `${environment.apiUrl}/command`,  
      cmd
    ).pipe(map(()=>{ 
      console.log("Posted ok.")
    }));
  }

  /// Changes a command
  modifyCommand(cmd: Command )  : Observable<void>  {
    return this.http.put<Command>(
      `${environment.apiUrl}/command/${cmd.id}`,
      cmd
    ).pipe(map(()=>{ 
      console.log("Modified ok.")
    }));
  }

  /// Remove a command
  removeCommand(id: number )  : Observable<void> {
    return this.http.delete<Command>(
      `${environment.apiUrl}/command/${id}`).pipe(map(()=>{ 
        console.log("Deleted ok.")
      }));
  }

}
