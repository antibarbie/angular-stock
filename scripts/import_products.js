const moment = require('moment');
const request = require('request');
const streams = require('memory-streams');
const csv = require('csv');
var ftpclient = require('ftp');
const fs = require('fs');
const magasin = require('../magasin.conf');
const es = require('event-stream');
const streamtransform = require('../stream-transform');

// Constante magasin DS5
var magasin_const = magasin.magasin_id;


function leadZero4(number) {
  if (number<=9999) { number = ("000"+number).slice(-4); }
  return number;
}

function leadZero2(number) {
  if (number<=99) { number = ("0"+number).slice(-2); }
  return number;
}

/// Table de produits REF => { Produit }
function productMap(products)
{
	return	products.reduce( function(r,a){ r[a.ref] = a; return r;} ,{});
}

/// Table de produits stock { Ref ; Qté Produit }
function stockList(inventory, added, removed)
{
  var finalMap = {};

	var mapi = inventory.reduce( (r,a) => { r[a.ref] = (+a.qty); return r;} ,{});
 // console.log(mapi);
	var mapa = added.reduce( (r,a) => { r[a.ref] = ((+r[a.ref])||0) + (+a.qty); return r;}, mapi);
 // console.log(mapa);
	var mapr = removed.reduce( (r,a) => { r[a.ref] = (+r[a.ref]||0) - (+a.qty); return r;}, mapa);
 // console.log(mapr);
  return (Object.keys(mapr)).map(kr => ({ ref: kr, qty: mapr[kr] }));
}



/// Générer du CSV sous forme de tableau d'objets
function generateData(csv_column, items, get_item_from_csv)
{
  //console.log("items:");
  //console.log(items);

  var generated_csv = [];
  for (const item of items) {
    var line = {};
    for (const column of csv_column) {
      line[column] = get_item_from_csv(item, column);
    }
    generated_csv.push(line);
  }
  return { header: csv_column, data: generated_csv };
}

/// Générer à partir de l'objet {header: data:} un stream CSV
function csv_generate_filestream(csv_data, callback)
{
  var writer = new streams.WritableStream();
  csv.stringify(csv_data.data, { columns: csv_data.header, record_delimiter: 'windows', header: true, delimiter: ';'  }, (err,datax)=> {
    console.log("csv**********************");
    console.log(datax);
    callback( datax );
  });//.pipe(writer).end();
  //return writer.toBuffer();
}

/// Effet final !
function generateOrUploadCsv(csv_data, generateonly) {

      csv_generate_filestream(csv_data, (datax) => {
        if (! generateonly) {
          console.log("Uploading to ftp ...");
           ftp_upload(csv_data.filename, datax, global_ftp_options, (err) => {
             if (err) {
               console.log("ECHEC ENVOI "+csv_data.filename + ": "+ err);
               console.log("Writing to file ...");
               fs.writeFile(csv_data.filename, datax, () => { console.log("ECRITURE REUSSIE "+csv_data.filename); });
             } else {
              console.log("ENVOI REUSSI "+csv_data.filename);
             }
          });
        } else {
          console.log("Writing to file ...");
          fs.writeFile(csv_data.filename, datax, () => { console.log("ECRITURE REUSSIE "+csv_data.filename); });
        }
      });
};

/// (1) Génération données STOCK - SEMAINE
function generateDataSTOCKWEEK( short_week_number, week_number, current_date, items, productmap )
{
  var mydata = generateData(
         //Magasin;No_Semaine;Date_Ref;Code_Article;Code_Barres;Fourn_Std;Marque;Stock
        ["Magasin","No_Semaine","Date_Ref","Code_Article","Code_Barres","Fourn_Std","Marque","Stock"],
        items.map( (i) => ({
          ref: i.ref,
          qty: i.qty,
          ean: productmap[i.ref].ean,
          fournisseur: productmap[i.ref].fournisseur,
          marque: productmap[i.ref].marque          }) ),
        (item, column) => {
          //console.log("getting value :" + column + " from : ");
          //console.log(item);

          if (column === "Magasin")
            return magasin_const;
          if (column === "No_Semaine")
            return week_number;
          if (column === "Date_Ref")
            return moment(current_date, "YYYY-MM-DD").format("DD/MM/YYYY");

          var value_source = {
            "Code_Article": "ref",
            "Code_Barres": "ean",
            "Fourn_Std": "fournisseur",
            "Marque": "marque",
            "Stock": "qty",
          }[column];
          var value_found = item[value_source];
          return value_found;
        }
      );
  return { filename: "STS"+short_week_number+"_"+magasin_const+".CSV", header: mydata.header, data: mydata.data };
}

/// (2) Génération données VENTE - SEMAINE
function generateDataSALEWEEK( short_week_number, week_number, current_date, itemslist, productmap )
{
  // Sommer les items en groupant par référence
  var items = groupByAggregate(itemslist,"ref", (samelist) => ({ qty: samelist.reduce((r,v) => r + (+v.qty), 0)}) );

  var mydata= generateData(
         //Magasin;No_Semaine;Date_Ref;Code_Article;Code_Barres;Fourn_Std;Marque;Qte_Vendue
        ["Magasin","No_Semaine","Date_Ref","Code_Article","Code_Barres","Fourn_Std","Marque","Qte_Vendue"],
        items.map( (i) => ({
          ref: i.ref,
          qty: i.qty,
          ean: productmap[i.ref].ean,
          fournisseur: productmap[i.ref].fournisseur,
          marque: productmap[i.ref].marque          }) ),
        (item, column) => {
          //console.log("getting value :" + column + " from : ");
          //console.log(item);

          if (column === "Magasin")
            return magasin_const;
          if (column === "No_Semaine")
            return week_number;
          if (column === "Date_Ref")
            return moment(current_date, "YYYY-MM-DD").format("DD/MM/YYYY");

          var value_source = {
            "Code_Article": "ref",
            "Code_Barres": "ean",
            "Fourn_Std": "fournisseur",
            "Marque": "marque",
            "Qte_Vendue": "qty",
          }[column];
          var value_found = item[value_source];
          return value_found;
        }
      ) ;
  return { filename: "VTS"+short_week_number+"_"+magasin_const+".CSV", header: mydata.header, data: mydata.data };
}

/// (3) Génération données STOCK - JOUR
function generateDataSTOCKDAY( current_hour, items, productmap )
{
  var mydata= generateData(
         //Magasin;Code_Article;Code_Barres;Stock;Cde_Frn
        ["Magasin","Code_Article","Code_Barres","Stock", "Cde_Frn"],
        items.map( (i) => ({
          ref: i.ref,
          qty: i.qty,
          ean: productmap[i.ref].ean,
          fournisseur: productmap[i.ref].fournisseur,
          marque: productmap[i.ref].marque          }) ),
        (item, column) => {

          if (column === "Magasin")
            return magasin_const;
          if (column === "Cde_Frn") // XXX TODO: pas implémenté
            return 0;

          var value_source = {
            "Code_Article": "ref",
            "Code_Barres": "ean",
            "Stock": "qty",
          }[column];
          var value_found = item[value_source];
          return value_found;
        }
      );
  return { filename: "STC"+current_hour+"_"+magasin_const+".CSV", header: mydata.header, data: mydata.data };
}

/// (4) Génération données VENTES - JOUR (CA)
function generateDataCA( current_hour,itemslist, productmap )
{
  // Sommer les items en groupant par référence
  var items = groupByAggregate(itemslist,"ref",
                               (samelist) => ({
                                 qty: samelist.reduce((r,v) => r + (+v.qty), 0) ,//SUM
                                 date: samelist.reduce((r,v) => r || (v.date), undefined), // FIRST
                                 pht: samelist.reduce((r,v) => r + (+v.pht), 0) , //SUM
                                 pttc: samelist.reduce((r,v) => r + (+v.pttc), 0) , //SUM
                              }) );

  var mydata= generateData(
        ["Magasin","Date_Vente","Code_Article","Code_Barres","Code_Fourn","Code_Marque","Gamme","Qte","CA_HT","CA_TTC"],
        items.map( (i) => ({
          ref: i.ref,
          date: i.date,
          qty: i.qty,
          pht: i.pht,
          pttc: i.pttc,
          ean: productmap[i.ref].ean,
          description: productmap[i.ref].description,
          fournisseur: productmap[i.ref].fournisseur,
          marque: productmap[i.ref].marque,
          gamme: productmap[i.ref].gamme }) ),
        (item, column) => {
          //console.log("getting value :" + column + " from : ");
          //console.log(item);

          if (column === "Magasin")
            return magasin_const;
          var value_source = {
            "Date_Vente": "date",
            "Code_Article": "ref",
            "Code_Barres": "ean",
            "Code_Fourn": "fournisseur",
            "Code_Marque": "marque",
            "Gamme": "gamme",
            "Qte": "qty",
            "CA_HT": "pht",
            "CA_TTC": "pttc"
          }[column];
          var value_found = item[value_source];
          // Formatter la date
          if (column === value_source) {
            return moment(value_source, "YYYY-MM-DD").format("DD/MM/YYYY");
          }
          return value_found;
        }
      );
  return { filename: "CA_"+current_hour+"_"+magasin_const+".CSV",  header: mydata.header, data: mydata.data };
}

// HACK // // MARQUE -> CODE MARQUE
function marqueToCode(marque){
    if (marque === "NEFF")
        return "NEF";
    if (marque === "BOSCH")
        return "BOC";
    if (marque === "SIEMENS")
        return "SIE";
    return marque;
}

//----------------------------------------------------------------------------------------------------------

var arguments = require('minimist')(process.argv.slice(2));

if ( //(! arguments.weekstock && ! arguments.weeksale && !arguments.daystock && !arguments.daysale)|| 
[!!arguments.importgroupeimage,!! arguments.importstock].filter(x=>x).length != 1
)
{
  console.log("One option only in --importgroupeimage=ficSAM.csv | --importstock=stock.csv ");
  console.dir(arguments);
  return -1;
}

//DATE DE MISE A JOUR DES TARIFS : 27/09/2019															
//Code article	Marque	Famille	Sous-famille	PVGC T.T.C.	Coeff.	Commentaires	P	Gamme	Prix facture fournisseur	R HF D	R HF C	R P PR	Prix net fournisseur	Prix net grossiste	Code barre
//HM676G0W1F	SIEMENS	CUISSON	Four combi micro ondes	1499	2.23		P		738.38	9	0	0	671.93	729.98	4242003672013
//HB672GBW1S	SIEMENS	CUISSON	Four encastrable pyrolyse	969	2.13		P		500	9	0	0	455	494.31	4242003814673
//HB672GBW1F	SIEMENS	CUISSON	Four encastrable pyrolyse	929	2.35		P		435.09	9	0	0	395.93	430.15	4242003672549
//HB675G5W1F	SIEMENS	CUISSON	Four encastrable pyrolyse	1159	2.25		P	R	567.01	9	0	0	515.98	560.56	4242003671740


// -------------------------------------------------------------------------------------------
// Import groupe image et sons
// -------------------------------------------------------------------------------------------
if (arguments.importgroupeimage)
{
    console.log("import groupe image et son : " + arguments.importgroupeimage);

    const csvparse = csv.parse({  
        delimiter: ';',
        columns: true,
        from_line: 2,
        bom: true,
        //Code article;Marque;Famille;Sous-famille;PVGC T.T.C.;Coeff.;Commentaires;P;Gamme;Prix facture fournisseur;R HF D;R HF C;R P PR;Prix net fournisseur;Prix net grossiste;Code barre
    });

    var targets = [];

    csvparse.on('readable', () => {
        let record
        while (record = csvparse.read()) {
           //output.push(record)
           if (arguments.logonly) {
               console.log(record);
           } else {
               
               var target = {
                id: record['Code article'], // ATTENTION LA BASE VEUT "ID" comme clef !
                ean: record['Code barre'],
                fournisseur: 'BSH',
                marque: marqueToCode(record['Marque']), 
                gamme: record['Gamme'],
                description: "" + record['Famille'] + " " + record['Sous-famille']
               };

               targets.push(target);
           }
        }
      })
      .on('error', (err) => {
        console.error(err.message)
      })
      .on('end', () => {
        console.error("csv done.")

        for (const target of targets)
        {
            console.log(target);
               
            request.post({url: 'http://localhost:3000/produit/', json: target },
             (err, res, body) => {
             if (err) { return console.log(err); }
             if (res.statusCode != 201) {
                 if (arguments.forceupdate) {
                     console.log("Forcing update of: "+ target.id);
                     request.patch({url: 'http://localhost:3000/produit/' + target.id, json: target },() => {} );
                 } else {
                     console.log(`@@ Error when POSTing (use --forceupdate to update existing data). -> statusCode: ${res.statusCode} for ${target.id}`);
    
                 }
    
             }
             });    
        }


      });

    fs.createReadStream(arguments.importgroupeimage, { encoding: arguments.encoding || 'latin1'})
    //.pipe(es.split())
    //.pipe(new streamtransform.killFirstLine())
    .pipe(csvparse)
    .on('error', function(err){
        console.log('@@@@@  Error while reading file.', err);
    })
    .on('end', function(){
        console.log('Read entire file OK.')
    });
}



// -------------------------------------------------------------------------------------------
// Import STOCK
// -------------------------------------------------------------------------------------------
if (arguments.importstock)
{
    console.log("import stock : " + arguments.importstock);

    const csvparse = csv.parse({  
        delimiter: ';',
        columns: false,
        from_line: 1,
        bom: true,
        //Code article;Marque;Famille;Sous-famille;PVGC T.T.C.;Coeff.;Commentaires;P;Gamme;Prix facture fournisseur;R HF D;R HF C;R P PR;Prix net fournisseur;Prix net grossiste;Code barre
    });

    var targets = [];

    csvparse.on('readable', () => {
        let record
        while (record = csvparse.read()) {
            var target = {
                ref: record[0],
                qty: (+record[1])
            };
            if (arguments.logonly) {
                console.log(target);
            } else {
                targets.push(target);
            }
        }
      })
      .on('error', (err) => {
        console.error(err.message)
      })
      .on('end', () => {

        if (targets.length > 0)
        {
            console.error("CSV done. Creating Inventory")

            var inventory = {
                // id c'est la date
                id: moment(new Date()).format("YYYY-MM-DD"),
                item: targets
            };
    
            // Création d'un inventaire
            request.post({url: 'http://localhost:3000/inventaire/', json: inventory },
                (err, res, body) => {
                if (err) { return console.log(err); }
                if (res.statusCode != 201) {
                    if (arguments.forceupdate) {
                        console.log("Forcing update of: "+ inventory.id);
                        request.patch({url: 'http://localhost:3000/inventaire/' + inventory.id, json: inventory },() => {} );
                    } else {
                        console.log(`@@ Error when POSTing (use --forceupdate to update existing data). -> statusCode: ${res.statusCode} for ${inventory.id}`);    
                    }
                }
                });    
        }
        else{
            console.log("nothing to do.");
        }


      });

    fs.createReadStream(arguments.importstock, { encoding: arguments.encoding || 'utf8'})
    .pipe(csvparse)
    .on('error', function(err){
        console.log('@@@@@  Error while reading file.', err);
    })
    .on('end', function(){
        console.log('Read entire file OK.')
    });
}
