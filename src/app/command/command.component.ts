import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { Product } from '../model/product';
import { ProductService } from '../product.service';
import { CommandService } from '../command.service';
import { Command } from '../model/command';
import * as moment from 'moment';
import {switchMap, debounceTime} from 'rxjs/operators';

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
      ref: new FormControl('', [ Validators.required, Validators.minLength(2)] ),// this.checkProductExists.bind(this)),
      qty: new FormControl('1', [ Validators.required, Validators.min(1)])
    });
   }

   resetForm() {
    this.commandGroup.get('ref').setValue('');
    this.commandGroup.get('qty').setValue('1');
    this.commandGroup.markAsPristine();
    this.commandGroup.markAsUntouched();
   }

   searchAgain() {
    this.currentCommand$ = this.commandService.getCurrentCommands(this.commandlimit);
    this.previousCommand$ = this.commandService.getOldCommands(this.commandlimit, this.offset);

    this.resetForm();
    //this.commandGroup.get('ref').setValue('');
    //this.commandGroup.get('ref').dirty = false;
    //this.commandGroup.get('qty').setValue('1');

    //this.commandGroup.reset();
    //this.commandGroup.get('ref').setValue('');
    //this.commandGroup.get('ref').reset();
   }

  ngOnInit() {
    this.searchAgain();
    
    this.filteredProducts$ = this.commandGroup.get('ref')
      .valueChanges
      .pipe(
        debounceTime(300),
        switchMap(value => this.productService.getProducts(value, 10, 0) /* get 10 values max */)
      );
    // Changes searchvalue when input changes..
    //this.commandGroup.get('ref').valueChanges.subscribe(val => {
    //  this.searchValue = val;
    //});
  }

  // Vérifier qu'on a bien saisi un produit existant
  checkProductExists(control : FormControl) {
    return undefined;
  }

  /// Clic nouvelle commande
  onSubmitCommand() {
    var cmdAuto = this.commandGroup.value as Command;
    var cmd = new Command(this.commandGroup.get('ref').value, 
    this.commandGroup.get('qty').value, true, 
    moment(new Date()).format("YYYY-MM-DD"),
    undefined);

    console.log("Submit command :");
    console.log(cmd);
    console.log(cmdAuto);

    this.commandService.addCommand(cmd);
    this.searchAgain();
  }

  // Suivant dans la liste
  onNextClick() {
    this.offset += this.commandlimit;
    this.searchAgain();
  }

  // Précédent dans la liste
  onPrevClick() {
    this.offset = Math.max(0, this.offset - this.commandlimit);
    this.searchAgain();
  }
}
