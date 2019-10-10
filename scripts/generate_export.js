const moment = require('moment');
const request = require('request');
const streams = require('memory-streams');
const csv = require('csv');
var ftpclient = require('ftp');
const fs = require('fs');
const magasin = require('../magasin.conf');


// Constante magasin DS5
var magasin_const = magasin.magasin_id;
// Valeurs FTP
var global_ftp_options = magasin.global_ftp_options;

// Fonction groupir !!
function groupByAggregate(arr, prop, aggreg) {
    const map = new Map(Array.from(arr, obj => [obj[prop], []]));
    arr.forEach(obj => map.get(obj[prop]).push(obj));

    var grouped_select = Array.from(map.keys()).map( propval => {
      var v = aggreg(map.get(propval));
      v[prop] = propval;
      return v;
    });
    //console.log("grouped_select:");
    //console.log(grouped_select);
  return grouped_select;
}



//
// UPLOAD A VIRTUAL FILE TO FTP
//
// ftp_options: { ftp_host, ftp_cwd, ftp_user, ftp_pass, ftp_port }
function ftp_upload(filename, csv_data, ftp_options, callback)
{
  var buf = Buffer.from(csv_data, 'utf8');
  var c = new ftpclient();
  c.on('ready', function() {
    var nextput = () => c.put(buf, filename, function(err) {
      c.end();
      callback(err);
    });

    if (ftp_options.ftp_cwd) {
      c.cwd(ftp_options.ftp_cwd, () => {
        nextput();
      });
    } else {
      nextput();
    }

  });
  
  try 
  {
    // connect to localhost:21 as anonymous
    c.connect({host: ftp_options.ftp_host, port: ftp_options.ftp_port, user: ftp_options.ftp_user, password: ftp_options.ftp_pass});
  } 
  catch(errrr)
  {
    // Send the error back to caller
    callback(errrr);
  }
}

/* For a given date, get the ISO week number
 *
 * Based on information at:
 *
 *    http://www.merlyn.demon.co.uk/weekcalc.htm#WNR
 *
 * Algorithm is to find nearest thursday, it's year
 * is the year of the week number. Then get weeks
 * between that date and the first day of that year.
 *
 * Note that dates in one year can be weeks of previous
 * or next year, overlap is up to 3 days.
 *
 * e.g. 2014/12/29 is Monday in week  1 of 2015
 *      2012/1/1   is Sunday in week 52 of 2011
 */
function getWeekNumber(d) {
    // Copy date so don't modify original
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    // Get first day of year
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    // Calculate full weeks to nearest Thursday
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    // Return array of year and week number
    return [d.getUTCFullYear(), weekNo];
}

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
	return	products.reduce( (r,a) =>{ 
    a.ref = a.id; // re-create "id" : "ref"
    r[a.id] = a;
    return r;
  } ,{});
}

/// Table de produits stock { Ref ; Qté Produit }
function stockList(inventory, added, removed)
{
  var finalMap = {};

  // Initial inventory
	var mapi = inventory.reduce( (r,a) => { r[a.ref] = (+a.qty); return r;} ,{});
 // console.log(mapi);
  // Commands / received products
	var mapa = added.reduce( (r,a) => { r[a.ref] = ((+r[a.ref])||0) + (a.expected ? 0 : (+a.qty)); return r;}, mapi);
  // Commands / expected products
	var map_expected = added.reduce( (r,a) => { r[a.ref] = ((+r[a.ref])||0) + (a.expected ? (+a.qty) : 0); return r;}, {});
  // console.log(mapa);
  // Sales / sold products
	var mapr = removed.reduce( (r,a) => { r[a.ref] = (+r[a.ref]||0) - (+a.qty); return r;}, mapa);
 // console.log(mapr);

  //nb: éviter -1 stock en cas de vente sur commande
  return (Object.keys(mapr)).map(kr => ({ ref: kr, qty: Math.max(0,mapr[kr]), cmd: (map_expected[kr]||0) }));
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
              console.log("ENVOI OK : "+csv_data.filename);
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
        items
        .filter(i => productmap[i.ref])  // ELIMINER UN PRODUIT NON REFERENCE
        .map( (i) => ({
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
        items
        .filter(i => productmap[i.ref])  // ELIMINER UN PRODUIT NON REFERENCE
        .map( (i) => ({
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
        ["Magasin","Code_Article","Code_Barres","Marque","Stock", "Cde_Frn"],
        items
          .filter(i => productmap[i.ref]) // ELIMINER UN PRODUIT NON REFERENCE
          .map( (i) => ({
          ref: i.ref,
          qty: i.qty,
          cmd: i.cmd,
          ean: productmap[i.ref].ean,
          fournisseur: productmap[i.ref].fournisseur,
          marque: productmap[i.ref].marque          }) ),
        (item, column) => {

          if (column === "Magasin")
            return magasin_const;
          //if (column === "Cde_Frn") // XXX TODO: pas implémenté
          //  return 0;

          var value_source = {
            "Code_Article": "ref",
            "Code_Barres": "ean",
            "Marque": "marque",
            "Stock": "qty",
            "Cde_Frn": "cmd"
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
        items
        .filter(i => productmap[i.ref])  // ELIMINER UN PRODUIT NON REFERENCE
        .map( (i) => ({
          ref: i.ref,
          date: moment(i.date, "YYYY-MM-DD").format("DD/MM/YYYY"),
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

//----------------------------------------------------------------------------------------------------------
//
// Command line arguments
//
// --weekstock [--date=]
// --weeksale [--date=]
// --daystock  [--date=]
// --daysale  [--date=]
//
// --ftpuser --date
// --generateonly
//
//----------------------------------------------------------------------------------------------------------

var arguments = require('minimist')(process.argv.slice(2));

if ( //(! arguments.weekstock && ! arguments.weeksale && !arguments.daystock && !arguments.daysale)|| 
[!!arguments.weekstock,!! arguments.weeksale,!!arguments.daystock,!!arguments.daysale].filter(x=>x).length > 1
)
{
  console.log("One option only in --weekstock | --weeksale | --daystock | --daysale.");
  console.log("Arguments: ( --weekstock | --weeksale | --daystock | --daysale ) [--date --ftpuser --ftphost --ftpport --ftppass --ftpcwd --generateonly]");
  console.dir(arguments);
  return -1;
}

// Plage de dates considérées
var current_date = moment(new Date());
if (arguments.date) {
	current_date = moment(arguments.date);
  if (!current_date.isValid()) {
    console.log("date invalide: "+arguments.date);
    return -1;
  }
}
var current_date_txt = current_date.format("YYYY-MM-DD");
console.log("Current Working Date: "+ current_date_txt);
var wk = getWeekNumber(current_date.toDate());
var current_week_year = leadZero4(wk[0]);
var current_week_number = leadZero2(wk[1]);
var current_long_week = current_week_year + current_week_number;
var current_short_week = current_week_year.slice(-2) + current_week_number;
console.log("Current Week "+ current_week_number + " of year " + current_week_year + " long:"+current_long_week+" short:"+current_short_week);
var current_time = current_date.format("YYYYMMDDHHmm");
console.log("Extraction timestamp: "+ current_time);

// -------------------------------------------------------------------------------------------
// Ventes du jour et de la semaine
// -------------------------------------------------------------------------------------------
if (arguments.daysale || arguments.weeksale)
{
	// CHOPPER LES VENTES        // CHOPPER LES PRODUITS CORRESPONDANTS        // CROISER TOUT CA
  // ECRIRE CSV        // ENVOYER FTP

  var weekmode = !!arguments.weeksale;

  // [ DATE à DATE - 6 JOURS ] pour la semaine, sinon même date unique
  var begin_date_txt = moment(current_date).subtract(6, 'days').format("YYYY-MM-DD");

	request.get({url: 'http://localhost:3000/vente/',
    qs:{ "date_gte": weekmode ? begin_date_txt : current_date_txt, "date_lte":current_date_txt }, json: true },
    (err, res, items) => {
		if (err) { return console.log(err); }
		console.log("sales received ok.");
		console.log(items);

		var product_array = items.map(x => x.ref); // produits concernés
    if (product_array.length == 0) product_array = [ "NO-PRODUCT-FOUND" ]; // GARDE FOU

	        request.get({url: 'http://localhost:3000/produit/', qs:{ "id": product_array }, qsStringifyOptions: { arrayFormat: "repeat" }, json: true }, (err, res, products) => {
	                if (err) { return console.log(err); }
        	        console.log("products received ok.");
                	console.log(products);
			// Croiser les choumoulous
			var productmap = productMap(products);

      // Magasin;Date_Vente;Code_Article;Code_Barres;Code_Fourn;Code_Marque;Gamme;Qte;CA_HT;CA_TTC
      // Magasin;No_Semaine;Date_Ref;Code_Article;Code_Barres;Fourn_Std;Marque; Qté
      // VENTE - PRODUIT
      var csv_data = weekmode ?
        generateDataSALEWEEK( current_short_week, current_long_week,  current_date_txt, items, productmap )
      : generateDataCA( current_time, items, productmap );

      console.log("---- csv_data :");
      console.log(csv_data);
      generateOrUploadCsv(csv_data, arguments.generateonly);

		});
	});

}

// -------------------------------------------------------------------------------------------
// Stock de la semaine
// -------------------------------------------------------------------------------------------
if (arguments.daystock || arguments.weekstock)
{
	// CHOPPER L'INVENTAIRE LE PLUS RECENT
  // CHOPPER LES RECEPTION ET LES VENTES
  // CHOPPER LES PRODUITS CORRESPONDANTS        // CROISER TOUT CA
  // ECRIRE CSV        // ENVOYER FTP
  var weekmode = !!arguments.weekstock;

	request.get({url: 'http://localhost:3000/inventaire/', qs:{ "_sort":"id","_order":"desc","_limit":"1", "id_lte": current_date_txt }, json: true }, (err, res, invs) => {
		if (err) { return console.log(err); }
		if (invs.length != 1) {
      console.log("@@@@ Bad inventory returned");
      return console.log(invs);
    }
    var inv = invs[0];//One and only one
    inv.date = inv.id; // HACK-RENOMMAGE ID
		console.log("Last inventory received ok. Previous inventory date: "+inv.date);
		//console.log(inv);

    // command
	request.get({url: 'http://localhost:3000/command/', qs:{ "date_gte": inv.date, "date_lte": current_date_txt }, json: true }, (err, res, recep) => {
		if (err) { return console.log(err); }
		console.log("Commands received ok. "+ recep.length);
		//console.log(recep);

    // vente
	request.get({url: 'http://localhost:3000/vente/', qs:{ "date_gte": inv.date, "date_lte": current_date_txt }, json: true }, (err, res, sales) => {
		if (err) { return console.log(err); }
		console.log("Sales received ok. "+sales.length);
		//console.log(sales);

    // map [ REF ] = INVENTORY + RECEPTION - SALES
    var stocklist = stockList(inv.item, recep, sales);
    //console.log("-------------- stocklist");
    //console.log(stocklist);
    var product_filtered = stocklist.filter(s => s.qty>0 || s.cmd>0);
    //console.log("-------------- filtered");
    //console.log(product_filtered);
		var product_array = product_filtered.map(s => s.ref); // produits concernés
    if (product_array.length == 0) product_array = [ "NO-PRODUCT-FOUND" ]; // GARDE FOU

    request.get({url: 'http://localhost:3000/produit/', qs:{ "id": product_array }, qsStringifyOptions: { arrayFormat: "repeat" }, json: true }, (err, res, products) => {
	                if (err) { return console.log(err); }
        	        console.log("products received ok. " + products.length);
                	//console.log(products);
			// Croiser les choumoulous
			var productmap = productMap(products);

      //Magasin;No_Semaine;Date_Ref;Code_Article;Code_Barres;Fourn_Std;Marque;Stock
      // VENTE - PRODUIT
      var csv_data = weekmode ? generateDataSTOCKWEEK( current_short_week,current_long_week,current_date_txt,product_filtered, productmap )
      : generateDataSTOCKDAY( current_time, product_filtered, productmap );

      console.log("---- csv_data :");
      console.log(csv_data);
      generateOrUploadCsv(csv_data, arguments.generateonly);


		});

  });
  });
	});

}

