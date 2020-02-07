// This is only for development work
require('dotenv').config()

const mongo = require('mongodb')

// read in the password and username for the database from the env variables 
const password = process.env.DB_PW 
const username = process.env.DB_UN

// for username access. 
const uri = `mongodb+srv://${username}:${password}@cluster0-4nrid.mongodb.net/test?retryWrites=true&w=majority`

const connectOptions = { useNewUrlParser: true } 
// Object storing the collections in our database 

const COLLECTION = {
	usernames:"usernames",
	tracks: "tracks",
}

const DATABASE = "LastFM"

// this is for local mongodb development 
const server = 'mongodb://localhost:27017/timesheet' 

findAllActiveUsernameDiscord = (query, callback) => {
	_res = mongo.connect(uri, connectOptions, function(err, db) {
		// error check first 
		if (err) throw err;

		// get the right database 
		var dbo = db.db(DATABASE)
		
		// connect to the right collection and get an array of all messages 
		dbo.collection(COLLECTION.usernames).findOne(query, (err, res) =>{
			if(err){
				callback(null)
				console.error("No user found in the database")
			
			}
			console.log('FOUND IN DATABASE: ', res.username)
			callback(res.username) 

		
		})
	});		
}

// function to find all from a collection 
// query in the form {_id} or {_username}
findUsername = (query, callback) => {
	_res = mongo.connect(uri, connectOptions, function(err, db) {
		// error check first 
		if (err) throw err;

		// get the right database 
		var dbo = db.db(DATABASE)
		
		// connect to the right collection and get an array of all messages 
		dbo.collection(COLLECTION.usernames).findOne(query, (err, res) =>{
			if(err){
				callback(null)
				console.error("No user found in the database")
			
			}
			console.log('FOUND IN DATABASE: ', res.username)
			callback(res.username) 

		
		})
	});		
}

// create and update happen in the same function 
async function updateUsername(payload){
	
	// lets parse the payload first 
	query = {_id:payload._id};	

	await mongo.connect(uri, connectOptions).then(async db => {
		var dbo = db.db(DATABASE)
		// acquire the lock 	
		// we could try insert first and if there is an error, we 
		// then could try update. 
		await dbo.collection(COLLECTION.usernames).insertOne(payload)
		.then(res => {
			console.log(`Added ${payload._id} entry`);
		})
		.catch(async err =>{
			// if it is a duplicate key, we just need to update the entry	
			if(err === undefined) throw err;
			// if it is a duplicate entry, then we know all we have to do
			// is update it 
			if(err.code === 11000){
				// got here...
				await dbo.collection(COLLECTION.usernames)
						.updateOne(query,{$set:{username:payload.username, 
												did:payload.did, 
												discr:payload.discr					
							}
						
						})
				.then(res => {
					console.log(`Updated ${payload._id} entry`);	
				})
				.catch(err=>{
					if(err) throw err	
				})
			}
		})
	})
	.catch(err => {
		if(err) throw err		
	})
}

module.exports = {
	findUsername,
	updateUsername,
}
