require('dotenv').config()
const Discord = require('discord.js')
const db = require('./database.js')
const utils = require('./utils.js')

// create new discord client 
const client = new Discord.Client()

// function to send the picture
sendNowPlaying = msg => res => {
	if(!res){
		msg.reply("No track currently playing...")
	}else{
	// send the message 
		msg.reply(`*Currently Playing:* \n**Track:** ${res.name}\n**Album:** ${res.album}\n**Artist:** ${res.artist}\n\n**Scrobbles:** ${res.scrobbles}`, {files: [res.image[3]['#text']]})
	}
}

// login to the server that we want to connect to 
client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}`)
})

// Here is where we verify the message contents. We need to 
// ensure that the message is in the right format so that 
// our parsing will work 
client.on('message', async msg => {
	// if the message does not belong to a user/guild do nothing 
	if (!msg.guild) return;
	
	// if the message is a bot message, ignore it 
	if (msg.author.bot) return;
	
	uid = msg.author.id
	console.log(`${uid} sent message`)
		
	if (msg.content.search(/(\!nowplaying)/gmi)===0){
		var firstMention = msg.mentions.members.first()
		
		// if the person has mentioned a user, find the user 
		// in the DB 
		if(firstMention){
			db.findUsername({_id:firstMention.id}, getNowPlaying(sendNowPlaying(msg)))
		}else{
			// find the username in the message by finding the @tag
			db.findUsername({_id:msg.author.id}, getNowPlaying(sendNowPlaying(msg)))
		}
		console.log(`${uid} sent message`)
	
	} else if (msg.content.search(/!setFM/) === 0){
		// get the username
		uname = msg.content.replace(/(!setFM)[\s]+/gmi,'')
		uname = uname.replace(/[\n]*/g,'')
		console.log(msg.author)
		console.log('PARSED USERNAME: ', uname)
		db.updateUsername({_id:msg.author.id, 
				username:uname,
				discr:msg.author.discriminator,
				did:msg.author.username
		})
	}
	
})

// when you add a memeber to the database, add them to the database, -- admin can set their callsign 

client.on('guildMemberAdd', member => {
	console.log(member)
})

client.login(process.env.BOT_TOKEN)
