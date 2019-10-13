import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators, ValidationErrors } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { Product } from '../model/product';
import { ProductService } from '../product.service';
import { CommandService } from '../command.service';
import { Command } from '../model/command';
import * as moment from 'moment';
import {first, switchMap, debounceTime, map, flatMap} from 'rxjs/operators';

@Component({
  selector: 'app-command',
  templateUrl: './command.component.html',
  styleUrls: ['./command.component.scss']
})
export class CommandComponent implements OnInit {

  commandGroup: FormGroup;

  commandlimit : number = 100;

  currentCommand$ : Observable<Command[]>;
  previousCommand$ : Observable<Command[]>;

  filteredProducts$ : Observable<Product[]>;

  offset : number;

  constructor(private productService: ProductService, private commandService: CommandService ) {
    this.offset = 0;

    this.commandGroup = new FormGroup({
      ref: new FormControl('', [ Validators.required, Validators.minLength(2)] ,  this.productService.checkProductExists.bind(this.productService) ),
      qty: new FormControl('1', [ Validators.required, Validators.min(1)])
    });
   }

   // Default values for "new" form
   resetForm() {
    this.commandGroup.get('ref').setValue('');
    this.commandGroup.get('qty').setValue('1');
    this.commandGroup.markAsPristine();
    this.commandGroup.markAsUntouched();
   }

   // updates search results
   searchAgain() {
    this.currentCommand$ = this.commandService.getCurrentCommands(this.commandlimit);
    this.previousCommand$ = this.commandService.getOldCommands(this.commandlimit, this.offset);

    this.resetForm();
   }

  ngOnInit() {
    this.searchAgain();

    // Auto-complete !
    this.filteredProducts$ = this.commandGroup.get('ref')
      .valueChanges
      .pipe(
        debounceTime(300),
        switchMap(value => this.productService.getProducts(value, 10, 0) /* get 10 values max */)
      );
  }


  /// Click new command
  onSubmitCommand() {
    var cmdAuto = this.commandGroup.value as Command;
    var cmd = new Command(this.commandGroup.get('ref').value, 
    this.commandGroup.get('qty').value, true, 
    moment(new Date()).format("YYYY-MM-DD"),
    undefined);

    console.log("Submit command :");
    console.log(cmd);
    console.log(cmdAuto);

    this.commandService.addCommand(cmd).subscribe(() => {
      this.searchAgain();
    });
  }

  // Next in list
  onNextClick() {
    this.offset += this.commandlimit;
    this.searchAgain();
  }

  // Previous in list
  onPrevClick() {
    this.offset = Math.max(0, this.offset - this.commandlimit);
    this.searchAgain();
  }

  // Cancel a command we never received !
  onCancelCommand(cmd : Command)//id : number) 
  {
    console.log("Deleting command :"+cmd.id);
    this.commandService.removeCommand(cmd.id).subscribe(() => {
      this.searchAgain();
    });
  }

  // Mark a command as received
  onReceiveCommand(cmd : Command)//id : number) 
  {
    console.log("Received command :");
    console.log(cmd);
    cmd.expected = false; // modify !
    this.commandService.modifyCommand(cmd).subscribe(() => {
      this.searchAgain();
    });

    //this.commandService.getCommandById(id).subscribe( cmd => {
    //   cmd.expected = false; // modify !
    //   this.commandService.modifyCommand(cmd);
    //});
  }
}
