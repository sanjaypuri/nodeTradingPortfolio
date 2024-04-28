const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const notifier = require('node-notifier');
const db = require('./database');
const { render } = require('ejs');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.set('view engine', 'ejs');

const PORT = 5000;

app.get('/', (request, response) => {
  // notifier.notify('Message')
  const userData = request.cookies.userData;
  if (!userData) {
    response.redirect('/selectportfolio')
  } else {
    response.render('home', { userData });
  }
});

app.get('/selectportfolio', (request, response) => {
  const sql = `SELECT * FROM portfolios`;
  db.all(sql, (error, portfolios) => {
    if (error) {
      const errormsg = {
        type: "Error reading Portfolio List",
        details: error.message
      }
      response.render('errorpage', { errormsg });
    } else {
      if (portfolios.length < 1) {
        response.redirect('/newportfolio');
      } else {
        if (portfolios.length === 1) {
          response.cookie('userData', { 'id': portfolios[0].id, 'name': portfolios[0].name });
          response.redirect('/');
        } else {
          response.render('selectportfolio', { portfolios })
        }
      }
    }
  });
});

app.post('/selectportfolio', (request, response) => {
  const portfolioid = parseInt(request.body.portfolio);
  const sql = `SELECT * FROM portfolios WHERE id = ?`;
  db.get(sql, portfolioid, (error, portfolio) => {
    if (error) {
      const errormsg = {
        type: "Error reading Portfolio",
        details: error.message
      }
      response.render('errorpage', { errormsg });
    } else {
      response.cookie('userData', { id: portfolio.id, name: portfolio.name });
      response.redirect('/');
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
      response.redirect('/selectportfolio');
    }
  });
});

app.get('/showportfolio', (request, response) => {
  const userData = request.cookies.userData;
  let sql = `select
  *,
	buyqty-sellqty qtyinhand,
  sum(daygain) over  (partition by portfolioid) tdaygain,
  sum(gain) over  (partition by portfolioid) tgain,
  sum(marketvalue) over (partition by portfolioid) tvalue
  from
  (
    select
    f.shareid, ${userData.id} portfolioid, sl.name,
    sum(f.buyqty) buyqty, (sum(f.buyqty*f.buyrate)+sum(f.buybrokrage))/sum(f.buyqty) buyavg, 
    sum(f.buyqty*f.buyrate)+sum(f.buybrokrage) buycost, sum(f.sellqty) sellqty, 
    ifnull((sum(f.sellqty*f.sellrate)+sum(f.sellbrokrage))/sum(f.sellqty),0) sellavg,
    sl.price, (sum(f.buyqty)-sum(f.sellqty))*sl.price marketvalue, sl.temp changepercent, sl.Change, 
    (sl.price-sl.previous)*(sum(f.buyqty)-sum(f.sellqty)) daygain,
    (sl.price-((sum(f.buyqty*f.buyrate)+sum(f.buybrokrage))/sum(f.buyqty)))*(sum(f.buyqty)-sum(f.sellqty)) gain
    from
    (
      select
      b.portfolioid, b.shareid, b.qty buyqty, b.rate buyrate, b.brokrage buybrokrage,
      ifnull(ss.qty,0) sellqty, ifnull(ss.rate,0) sellrate, ifnull(ss.brokrage,0) sellbrokrage
      from buy b
      left join 
      (
        select s.buyid, sum(s.qty) qty, sum(s.qty*s.rate)/sum(s.qty) rate, sum(s.brokrage) brokrage
        from sell s
        group by s.buyid
      ) ss on ss.buyid = b.id
      where portfolioid = ? and buyqty-sellqty > 0
    ) f
    left join shareslist sl on sl.id = f.shareid
    group by f.shareid
  )
  where qtyinhand > 0
  order by name
`;
  db.all(sql, userData.id, (error, rows) => {
    if (error) {
      const errormsg = {
        type: "Error computing portfolio",
        details: error.message
      }
      response.render('errorpage', { errormsg });
    } else {
      if (rows.length > 0) {
        response.render('showportfolio', { rows, userData });
      } else {
        const errormsg = {
          type: "Empty Portfolio",
          details: "No shares are available in this portfolio"
        }
        response.render('errorpage', { errormsg });
      }
    }
  });
})

app.get('/buy', (request, response) => {
  const userData = request.cookies.userData;
  let sql = `SELECT id, name from shareslist order by name`;
  db.all(sql, (error, shares) => {
    if (error) {
      const errormsg = {
        type: "Error loading Shares List",
        details: error.message
      }
      response.render('errorpage', { errormsg });
    } else {
      response.render('buy', { shares, userData });
    }
  });
});

app.post('/buy', (request, response) => {
  const tdate = request.body.date;
  const shareid = parseInt(request.body.selectShare);
  const qty = parseInt(request.body.qty);
  const rate = parseFloat(request.body.rate);
  const brokrage = parseFloat(request.body.brokrage);
  const portfolioid = parseInt(request.body.portfolioid);
  const sql = `INSERT INTO buy (tdate, shareid, qty, rate, brokrage, portfolioid) VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(sql, [tdate, shareid, qty, rate, brokrage, portfolioid], (error) => {
    if (error) {
      const errormsg = {
        type: "Error saving new purchases",
        details: error.message
      }
      response.render('errorpage', { errormsg });
    } else {
      response.redirect(`/showportfolio`);
    }
  });
});

app.get('/selllist', (request, response) => {
  const userData = request.cookies.userData;
  const sql = `   SELECT * FROM 
                  (
                  SELECT
                  b.portfolioid, p.name portfolioname, b.id, b.shareid, b.tdate purdate, 
                  sl.Name Share, b.qty-ifnull(s.qty,0) qtyinhand, b.rate
                  FROM buy b
                  LEFT JOIN portfolios p ON p.id = b.portfolioid
                  LEFT JOIN shareslist sl ON sl.id = b.shareid
                  LEFT JOIN
                    (
                      SELECT buyid, sum(qty) qty FROM sell GROUP BY buyid
                    ) s ON s.buyid = b.id
                  )
                  WHERE qtyinhand > 0 AND portfolioid = ${userData.id}`;
  db.all(sql, (error, shares) => {
    if (error) {
      const errormsg = {
        type: "Error retriving list of saleable Shares",
        details: error.message
      }
      response.render('errorpage', { errormsg });
    } else {
      response.render('selllist', { shares });
    }
  });
});

app.get('/sell/:buyid/:qtyinhand', (request, response) => {
  const buyid = parseInt(request.params.buyid);
  const qtyinhand = parseInt(request.params.qtyinhand);
  const sql = `SELECT b.shareid, sl.Name sharename, b.portfolioid, p.name portfolioname FROM buy b
                LEFT JOIN shareslist sl ON sl.id = b.shareid 
                LEFT JOIN portfolios p ON p.id = b.portfolioid 
                WHERE b.id = ?`;
  db.get(sql, buyid, (error, row) => {
    if (error) {
      const errormsg = {
        type: "Error retriving share details for buyID",
        details: error.message
      }
      response.render('errorpage', { errormsg });
    } else {
      response.render('sell', { row, buyid, qtyinhand });
    }
  });
});

app.post('/sell', (request, response) => {
  const buyid = parseInt(request.body.buyid);
  const tdate = request.body.date;
  const qty = parseInt(request.body.qty);
  const rate = parseFloat(request.body.rate);
  const brokrage = parseFloat(request.body.brokrage);
  const portfolioid = parseInt(request.body.portfolioid);
  const sql = `INSERT INTO sell (buyid, tdate, qty, rate, brokrage) VALUES (?, ?, ?, ?, ?)`;
  db.run(sql, [buyid, tdate, qty, rate, brokrage], (error) => {
    if (error) {
      const errormsg = {
        type: "Error saving new sales",
        details: error.message
      }
      response.render('errorpage', { errormsg });
    } else {
      response.redirect(`/showportfolio`);
    }
  });
});

app.get('/buyregister', (request, response) => {
  const userData = request.cookies.userData;
    const sql = `SELECT
                    b.tdate,
                    sl.name,
                    b.qty,
                    b.rate,
                    b.brokrage,
                    b.qty*b.rate buyvalue,
                    (b.qty*b.rate)+b.brokrage buycost,
                    ((b.qty*b.rate)+b.brokrage)/b.qty buyavg
                  FROM buy b
                  LEFT JOIN shareslist sl on sl.id = b.shareid
                  WHERE portfolioid = ?
                  ORDER BY b.tdate DESC`;
  db.all(sql, userData.id, (error, rows) => {
    if (error) {
      const errormsg = {
        type: "Error reading Purchase Register",
        details: error.message
      }
      response.render('errorpage', { errormsg });
    } else {
      if (rows.length > 0) {
        response.render('buyregister', { rows, userData });
      } else {
        const errormsg = {
          type: "Purchase Register Empty",
          details: "No entries available in the Purchase Register"
        }
        response.render('errorpage', { errormsg });
      }
    }
  });
});

app.get('/sellregister', (request, response) => {
  const userData = request.cookies.userData;
    const sql = `SELECT
                    s.tdate,
                    sl.Name,
                    s.qty,
                    s.rate,
                    s.brokrage,
                    s.qty*s.rate sellvalue,
                    (s.qty*s.rate)-s.brokrage sellcost,
                    ((s.qty*s.rate)-b.brokrage)/s.qty sellavg,
                    (s.rate-b.rate)*s.qty gain,
                    SUM((s.rate-b.rate)*s.qty) OVER (PARTITION BY b.portfolioid) tgain
                    FROM sell s
                  LEFT JOIN buy b ON b.id = s.buyid
                  LEFT JOIN shareslist sl on sl.id = b.shareid
                  WHERE b.portfolioid = ?
                  ORDER BY s.tdate DESC`;
  db.all(sql, userData.id, (error, rows) => {
    if (error) {
      const errormsg = {
        type: "Error reading Sale Register",
        details: error.message
      }
      response.render('errorpage', { errormsg });
    } else {
      if (rows.length > 0) {
        response.render('saleregister', { rows, userData });
      } else {
        const errormsg = {
          type: "Sale Register Empty",
          details: "No entries available in the Sale Register"
        }
        response.render('errorpage', { errormsg });
      }
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running at port ${PORT}`);
});
