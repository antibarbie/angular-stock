import { NgModule } from '@angular/core';
import { Routes, RouterModule, PreloadAllModules } from '@angular/router';

import { ProductListComponent } from './product-list/product-list.component';
import { HomeComponent } from './home/home.component';
import { SaleComponent } from './sale/sale.component';
import { CommandComponent } from './command/command.component';
import { InventoryComponent } from './inventory/inventory.component';


const routes: Routes = [
  { path:'', pathMatch: 'full', component: HomeComponent},
  { path: 'product-list', component: ProductListComponent },
  { path: 'sale', component: SaleComponent },
  { path: 'command', component: CommandComponent },
  { path: 'inventory', component: InventoryComponent },
//  { path:'**', redirectTo: '' }
  

];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    //useHash: true,
    //preloadingStrategy: PreloadAllModules,
    enableTracing: true
  })],
  exports: [RouterModule]
}) 
export class AppRoutingModule { }
