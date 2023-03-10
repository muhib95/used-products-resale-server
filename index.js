const express = require('express')
const cors = require('cors')
const SSLCommerzPayment = require('sslcommerz-lts')
const app = express()
const port = process.env.PORT||5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require("stripe")(process.env.STRIP_SECRET);



app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.c8jqjnz.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
function varifyJWT(req,res,next){
  const authHeader=req.headers.authorization;
  if(!authHeader){
    return res.status(401).send({message:'unauthorize'});
  }
  const token=authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRETE, function(err, decoded) {
    if(err){
      return res.status(401).send({message:'unauthorize'});
    }
    req.decoded=decoded;
    next();
  });


}

async function run() {
    try{
        const usersCollection=client.db('usedTvBuyAndSell').collection('users');
        const categoryCollection=client.db('usedTvBuyAndSell').collection('category');
        const productsCollection=client.db('usedTvBuyAndSell').collection('products');
        const bookingCollection=client.db('usedTvBuyAndSell').collection('booking');
        const reportItemsCollection=client.db('usedTvBuyAndSell').collection('reportItem');
        const paymentCollection=client.db('usedTvBuyAndSell').collection('payment');


        const store_id = process.env.SSL_ID;
        const store_passwd = process.env.STORE_PASS;
        const is_live = false //true for live, false for sandbox


        app.post("/create-payment-intent", async (req, res) => {
          const checked=req.body;
          const price=checked.resalePrice;
          const amount=price*100;
          const paymentIntent = await stripe.paymentIntents.create({
            currency: "usd",
            amount:amount,
            "payment_method_types": [
              "card"
            ]
            
          })
          res.send({
            clientSecret: paymentIntent.client_secret,
          });

        
        });
        app.post('/init', async(req, res) => {

          const order=req.body;
          const orderService=await productsCollection.findOne({_id:ObjectId(order.productId)});
          

          // console.log(order);
          // console.log(orderService);
          const data = {
              total_amount: orderService.resalePrice,
              currency: 'BDT',
              tran_id: new ObjectId().toString(), // use unique tran_id for each api call
              success_url: 'http://localhost:3030/success',
              fail_url: 'http://localhost:3030/fail',
              cancel_url: 'http://localhost:3030/cancel',
              ipn_url: 'http://localhost:3030/ipn',
              shipping_method: 'Courier',
              product_name: order.product,
              product_category: 'Electronic',
              product_profile: 'general',
              cus_name: order.name,
              cus_email: order.email,
              cus_add1: 'Dhaka',
              cus_add2: 'Dhaka',
              cus_city: 'Dhaka',
              cus_state: 'Dhaka',
              cus_postcode: '1000',
              cus_country: 'Bangladesh',
              cus_phone: order.phone,
              cus_fax: '01711111111',
              ship_name: 'Customer Name',
              ship_add1: order.location,
              ship_add2: 'Dhaka',
              ship_city: 'Dhaka',
              ship_state: 'Dhaka',
              ship_postcode: 1000,
              ship_country: 'Bangladesh',
          };
          // console.log(data);
          const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
          sslcz.init(data).then(apiResponse => {
              // Redirect the user to payment gateway
              let GatewayPageURL = apiResponse.GatewayPageURL
              res.send({url:GatewayPageURL})
              
          });
      })



        app.post('/paymentstore',async(req,res)=>{
          const payment=req.body;
          const result=await paymentCollection.insertOne(payment);
            res.send(result)


        })


// sslc payment


//JWT login register

app.get('/jwt',async(req,res)=>{

  const email=req.query.email;
  // console.log(em);
  const query={userEmail:email}
  const user=await usersCollection.findOne(query);
  // console.log(user);
  if(user){
    const token=jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRETE,{expiresIn:'7days'});
    return res.send({token:token});
  }
  res.status(403).send({token:''})
})


// jwt token google

          app.post('/jwt',(req,res)=>{
            const user=req.body;
            const token=jwt.sign(user,process.env.ACCESS_TOKEN_SECRETE,{expiresIn:'7days'})
            res.send({token})

          }) 


        app.post('/users',async(req,res)=>{
            const user=req.body;
            const result=await usersCollection.insertOne(user);
            res.send(result)
      
          })


          app.put('/users',async(req,res)=>{

              const userObj=req.body;

              const filter={userEmail:userObj.userEmail}
            const options = { upsert: true };
            const updateDoc = {
              $set: {
              
                  userName:userObj.userName,
                  userPhoto:userObj.userPhoto,
                  userRoles:userObj.userRoles,
                  varified:false



              }
            };
            const result=await usersCollection.updateOne(filter, updateDoc, options);
            res.send(result)

      
          })

      

          app.get('/category', async(req,res)=>{
            const query={};
            const result=await categoryCollection.find(query).toArray();
            res.send(result);
      
          })
          // app.get('/category/:id', async(req,res)=>{
          //   const id=req.params.id;
            
          //   const query={ brandId:id};
          //   const result=await productsCollection.find(query).toArray();
          //   res.send(result);
      
          // })

          app.get('/products/:brand',async(req,res)=>{
            const brand=req.params.brand;
           
            const query={brand:brand}
            const products=await productsCollection.find(query).toArray();
            res.send(products)
      
          })

  
         

          app.post('/addProduct',async(req,res)=>{
            const product=req.body;
            // console.log(product);
            const result=await productsCollection.insertOne(product);
            res.send(result)


          })

          app.put('/varifiedSellerProduct', varifyJWT,async(req,res)=>{

            const userObj=req.body;
            // console.log(userObj);

            const filter={sellerEmail:userObj.email}
          const options = { upsert: true };
          const updateDoc = {
            $set: {
                    verified:true
            }
          };
          const result=await productsCollection.updateMany(filter, updateDoc, options);
          res.send(result)

    
        })




        
          app.post('/booking',async(req,res)=>{
            const booked=req.body;

            const query={productId:booked.productId,
              email:booked.email

            };
            const alreadyHave=await bookingCollection.find(query).toArray();
            if(alreadyHave.length){
              const message="You already order"
              return res.send({acknowledged:false,message})

            }
            
            const result=await bookingCollection.insertOne(booked);
            res.send(result)
      
          })

app.get('/dashboard/payment/:id',async(req,res)=>{
  const id=req.params.id;
  const filter={_id:ObjectId(id)};
  const result=await productsCollection.findOne(filter);
  res.send(result);

})


          app.get('/users/admin/:email',async(req,res)=>{
              const email=req.params.email;
              
              // console.log(email);
              const query={userEmail:email};
              const user=await usersCollection.findOne(query);
              // console.log(user);
              res.send({isAdmin:user?.userRoles==="admin"})
        

          })

          app.get('/users/seller/:email',async(req,res)=>{
            const email=req.params.email;
            // console.log(email);
            const query={userEmail:email};
            const user=await usersCollection.findOne(query);
      
            res.send({isSeller:user?.userRoles==="Seller"});
            


        })
        app.get('/users/buyer/:email',async(req,res)=>{
          const email=req.params.email;
          // console.log(email);
          const query={userEmail:email};
          
          const user=await usersCollection.findOne(query);
        
          
          res.send({isBuyer:user?.userRoles==="user"});

      })


          app.get('/orders',varifyJWT, async(req,res)=>{
            const userEmail=req.query.email;
            // console.log(userEmail);
            const query={email:userEmail};
            const bookings=await bookingCollection.find(query).toArray();
            res.send(bookings);
      
          })

          app.get('/myproducts', async(req,res)=>{
            const userEmail=req.query.email;
            // console.log(userEmail);
            const query={sellerEmail:userEmail};
            const myProducts=await productsCollection.find(query).project({name:1,resalePrice:1,add:1}).toArray();
            res.send(myProducts);
      
          })

          app.delete('/myproducts/:id',varifyJWT, async(req,res)=>{
            const id=req.params.id;
            // console.log(userEmail);
            const query={ _id:ObjectId(id)};
            const result=await productsCollection.deleteOne(query);
            res.send(result);
      
          })

          app.put('/advertise',async(req,res)=>{
            const productInfo=req.body;
            // console.log(productInfo);
           const filter={_id:ObjectId(productInfo.id)}
         const options = { upsert: true };
         const updateDoc = {
           $set: {
            add:true

           }
         };
         const result=await productsCollection.updateOne(filter, updateDoc, options);
         res.send(result);
       })


       app.get('/advertisement',async(req,res)=>{
        const filter={add:true};
        const results=await productsCollection.find(filter).toArray();
        res.send(results);

       })


      

          

          app.get('/dashboard/allseller', async(req,res)=>{
           const filter={userRoles:"Seller"};
            const bookings=await usersCollection.find(filter).toArray();
            res.send(bookings);
      
          })
          app.get('/dashboard/allbuyers', async(req,res)=>{
            const filter={userRoles:"user"};
             const bookings=await usersCollection.find(filter).toArray();
             res.send(bookings);
       
           })

           app.get('/dashboard/reporttoadmin',async(req,res)=>{
            const filter={};
            const reportProduct=await reportItemsCollection.find(filter).toArray();
            res.send(reportProduct);
           })

           app.put('/seller',async(req,res)=>{
             const sellerObj=req.body;
            const filter={userEmail:sellerObj.email}
          const options = { upsert: true };
          const updateDoc = {
            $set: {
             varified:true

            }
          };
          const result=await usersCollection.updateOne(filter, updateDoc, options);
          res.send(result);
        })

        app.get('/usercheck',async(req,res)=>{
          const email=req.query.email;
// console.log(email)
          const filter={userEmail:email};
          const result=await usersCollection.findOne(filter); 
          res.send(result); 
          

             })

             app.post('/reporttoadmin',async(req,res)=>{
              const reporteItem=req.body;
              // console.log(reporteItem);
              const result=await reportItemsCollection.insertOne(reporteItem);
              res.send(result);
              


             })

             app.delete('/reporttoadminproduct/:id',varifyJWT, async(req,res)=>{
              const id=req.params.id;
              // console.log(userEmail);
              const query={ _id:ObjectId(id)};
              const result=await productsCollection.deleteOne(query);
              res.send(result);
        
            })


            app.delete('/sellerdelete/:id',varifyJWT, async(req,res)=>{
              const id=req.params.id;
              const query={ _id:ObjectId(id)};
              const result=await usersCollection.deleteOne(query);
              res.send(result);
        
            })




    }
    finally{

    }

}

run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Hello Worldnbbmbm!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})