const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database');
const { render } = require('ejs');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

const PORT = 5000;

app.get('/', (request, response) => {
  let sql = `SELECT * FROM portfolios`;
  db.all(sql, (error, portfolios) => {
    if (error) {
      const errormsg = {
        type: "Error reading Portfolio List",
        details: error.message
      }
      response.render('errorpage', { errormsg });
    } else {
      if (portfolios.length < 1) {
        const errormsg = {
          type: "No portfolios available.",
          details: "Please create a portfolio first..."
        }
        response.render('errorpage', { errormsg });
      } else {
        response.render('home', { portfolios });
      }
    }
  });
});

app.get('/shareslist', (request, response) => {
  const sql = `SELECT * FROM shareslist ORDER BY Name`;
  db.all(sql, (error, shares) => {
    if (error) {
      const errormsg = {
        type: "Error reading Shares List",
        details: error.message
      }
      response.render('errorpage', { errormsg });
    } else {
      response.render('shareslist', { shares });
    }
  });
});

app.get('/newportfolio', (request, response) => {
  response.render('newportfolio', {});
});

app.post('/newportfolio', (request, response) => {
  const sql = 'INSERT INTO portfolios (name) VALUES (?)';
  db.run(sql, request.body.portfolioname, (error) => {
    if (error) {
      const errormsg = {
        type: "Error creating new Portfolio",
        details: error.message
      }
      response.render('errorpage', { errormsg });
    } else {
      response.redirect('/');
    }
  });
});

app.post('/showportfolio', (request, response) => {
  const portfolioid = request.body.portfolio;
  let sql = `select *, 
              sum(daygain) over (partition by portfolioid) tdaygain,
              sum(totalgain) over (partition by portfolioid) ttotalgain
              from
              (
                select 
              	b.portfolioid, p.name portfolioname, b.id, b.shareid, sl.name, sl.price, b.qty buyQty, (b.rate*b.qty)+b.brokrage buyvalue, ((b.rate*b.qty)+b.brokrage)/b.qty buyavg, 
	              s.qty sellqty, s.value sellvalue, s.avg sellavg, b.qty-s.qty qtyinhand, (b.qty-s.qty)* (((b.rate*b.qty)+b.brokrage)/b.qty) buycost,
              	sl.price*(b.qty-s.qty) marketvalue, sl.temp changepercent, sl.change*( b.qty-s.qty) daygain, (sl.price-(((b.rate*b.qty)+b.brokrage)/b.qty))*(b.qty-s.qty) totalgain
              from buy b 
              left join 
            (select 
            	buyid, sum(qty) qty, sum(rate*qty)-sum(brokrage) value, (sum(rate*qty)-sum(brokrage))/sum(qty) avg     
              from sell 
            group by buyid) s on b.id = s.buyid
            left join shareslist sl on sl.id = b.shareid
            left join portfolios p on p.id = b.portfolioid
            where b.qty-s.qty > 0 and b.portfolioid = ?
            order by sl.name)`;
  db.all(sql, portfolioid, (error, rows) => {
    if (error) {
      const errormsg = {
        type: "Error computing portfolio",
        details: error.message
      }
      response.render('errorpage', { errormsg });
    } else {
      if (rows > 1) {
        console.log(rows);
        response.render('portfolio', { rows });
      } else {
        let sql = `SELECT *,
                  sum(daygain) over (partition by portfolioid) tdaygain,
                  sum(totalgain) over (partition by portfolioid) ttotalgain
                  from (
                  SELECT b.portfolioid, p.name portfolioname, b.id, b.shareid, sl.name, sl.price, b.qty buyQty,
                  (b.rate*b.qty)+b.brokrage buyvalue, ((b.rate*b.qty)+b.brokrage)/b.qty buyavg, 0 sellQty, 0 sellvalue,
                  0 sellavg, b.qty qtyinhand, (b.qty)* (((b.rate*b.qty)+b.brokrage)/b.qty) buycost, 
                  sl.price*(b.qty) marketvalue, sl.temp changepercent, sl.change*( b.qty) daygain, 
                  (sl.price-(((b.rate*b.qty)+b.brokrage)/b.qty))*b.qty totalgain FROM buy b
                  LEFT JOIN portfolios p ON p.id = b.portfolioid 
                  LEFT JOIN shareslist sl ON sl.id = b.shareid
                  WHERE portfolioid = ?
                  ORDER BY sl.name)`;
        db.all(sql, portfolioid, (error, rows) => {
          if (error) {
            const errormsg = {
              type: "Error computing buy only portfolio",
              details: error.message
            }
            response.render('errorpage', { errormsg });
          } else {
            console.log(rows);
            response.render('portfolio', { rows });
          }
        });
      }
    }
  });
})

app.get('/showportfolio/:portfolioid', (request, response) => {
  const portfolioid = request.params.portfolioid;
  let sql = `select *, 
              sum(daygain) over (partition by portfolioid) tdaygain,
              sum(totalgain) over (partition by portfolioid) ttotalgain
              from
              (
                select 
              	b.portfolioid, p.name portfolioname, b.id, b.shareid, sl.name, sl.price, b.qty buyQty, (b.rate*b.qty)+b.brokrage buyvalue, ((b.rate*b.qty)+b.brokrage)/b.qty buyavg, 
	              s.qty sellqty, s.value sellvalue, s.avg sellavg, b.qty-s.qty qtyinhand, (b.qty-s.qty)* (((b.rate*b.qty)+b.brokrage)/b.qty) buycost,
              	sl.price*(b.qty-s.qty) marketvalue, sl.temp changepercent, sl.change*( b.qty-s.qty) daygain, (sl.price-(((b.rate*b.qty)+b.brokrage)/b.qty))*(b.qty-s.qty) totalgain
              from buy b 
              left join 
            (select 
            	buyid, sum(qty) qty, sum(rate*qty)-sum(brokrage) value, (sum(rate*qty)-sum(brokrage))/sum(qty) avg     
              from sell 
            group by buyid) s on b.id = s.buyid
            left join shareslist sl on sl.id = b.shareid
            left join portfolios p on p.id = b.portfolioid
            where b.qty-s.qty > 0 and b.portfolioid = ?
            order by sl.name)`;
  db.all(sql, portfolioid, (error, rows) => {
    if (error) {
      const errormsg = {
        type: "Error computing portfolio",
        details: error.message
      }
      response.render('errorpage', { errormsg });
    } else {
      if (rows > 1) {
        console.log(rows);
        response.render('portfolio', { rows });
      } else {
        let sql = `SELECT *,
                  sum(daygain) over (partition by portfolioid) tdaygain,
                  sum(totalgain) over (partition by portfolioid) ttotalgain
                  from (
                  SELECT b.portfolioid, p.name portfolioname, b.id, b.shareid, sl.name, sl.price, b.qty buyQty,
                  (b.rate*b.qty)+b.brokrage buyvalue, ((b.rate*b.qty)+b.brokrage)/b.qty buyavg, 0 sellQty, 0 sellvalue,
                  0 sellavg, b.qty qtyinhand, (b.qty)* (((b.rate*b.qty)+b.brokrage)/b.qty) buycost, 
                  sl.price*(b.qty) marketvalue, sl.temp changepercent, sl.change*( b.qty) daygain, 
                  (sl.price-(((b.rate*b.qty)+b.brokrage)/b.qty))*b.qty totalgain FROM buy b
                  LEFT JOIN portfolios p ON p.id = b.portfolioid 
                  LEFT JOIN shareslist sl ON sl.id = b.shareid
                  WHERE portfolioid = ?
                  ORDER BY sl.name)`;
        db.all(sql, portfolioid, (error, rows) => {
          if (error) {
            const errormsg = {
              type: "Error computing buy only portfolio",
              details: error.message
            }
            response.render('errorpage', { errormsg });
          } else {
            console.log(rows);
            response.render('portfolio', { rows });
          }
        });
      }
    }
  });
})

app.get('/buy', (request, response) => {
  let sql = `SELECT id, name from shareslist order by name`;
  db.all(sql, (error, shares) => {
    if (error) {
      const errormsg = {
        type: "Error loading Shares List",
        details: error.message
      }
      response.render('errorpage', { errormsg });
    } else {
      let sql = `SELECT id, name FROM portfolios`;
      db.all(sql, (error, portfolios) => {
        if (error) {
          const errormsg = {
            type: "Error loading Portfolios List",
            details: error.message
          }
          response.render('errorpage', { errormsg });
        } else {
          response.render('buy', { shares, portfolios });
        }
      });
    }
  });
});

app.post('/buy', (request, response) => {
  const tdate = request.body.date;
  const shareid = parseInt(request.body.selectShare);
  const qty = parseInt(request.body.qty);
  const rate = parseFloat(request.body.rate);
  const brokrage = parseFloat(request.body.brokrage);
  const portfolioid = parseInt(request.body.selectPortfolio);
  const sql = `INSERT INTO buy (tdate, shareid, qty, rate, brokrage, portfolioid) VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(sql, [tdate, shareid, qty, rate, brokrage, portfolioid], (error) => {
    if (error) {
      const errormsg = {
        type: "Error saving new purchases",
        details: error.message
      }
      response.render('errorpage', { errormsg });
    } else {
      response.redirect(`/showportfolio/${portfolioid}`);
    }
  });
});

app.get('/selllist', (request, response)=>{
  const sql = `SELECT
	b.portfolioid, p.name portfolioname, b.id, b.shareid, b.tdate purdate, sl.Name Share, b.qty-ifnull(s.qty,0) qtyinhand, b.rate
  FROM buy b
  LEFT JOIN portfolios p ON p.id = b.portfolioid
  LEFT JOIN shareslist sl ON sl.id = b.shareid
  LEFT JOIN
    (
      SELECT buyid, sum(qty) qty FROM sell GROUP BY buyid
    ) s ON s.buyid = b.id`;
  db.all(sql, (error, shares)=>{
    if(error){
      const errormsg = {
        type: "Error retriving list of saleable Shares",
        details: error.message
      }
      response.render('errorpage', { errormsg });
    } else{
      response.render('selllist', {shares});
    }
  });
});

app.get('/sell/:buyid/:qtyinhand', (request, response)=>{
  const buyid = parseInt(request.params.buyid);
  const qtyinhand = parseInt(request.params.qtyinhand);
  const sql = `SELECT * FROM buy WHERE id = ?`;
  db.get(sql,  buyid, (error, row)=>{
    if(error){
      const errormsg = {
        type: "Error retriving share details for buyID",
        details: error.message
      }
      response.render('errorpage', { errormsg });
    } else {
      response.send({buyid, qtyinhand});

    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running at port ${PORT}`);
});
