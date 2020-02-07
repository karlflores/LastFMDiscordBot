require('dotenv').config()
const Discord = require('discord.js')
const db = require('./database.js')
const utils = require('./utils.js')

// create new discord client 
const client = new Discord.Client()

// function to send the picture
sendNowPlaying = tag => msg => res => {
	if(!res){
		msg.channel.send("<@"+tag.id+">"+" : No track currently playing...")
	}else{
	// send the message 
		console.log(tag.id)
		msg.channel.send(`<@${tag.id}> : *Currently Playing:* \n**Track:** ${res.name}\n**Album:** ${res.album}\n**Artist:** ${res.artist}\n\n**Scrobbles:** ${res.scrobbles}`, {files: [res.image[3]['#text']]})
	}
}

usernameUpdate = msg => uname => validated => {
	// update if it is validated 
	if(validated){
		console.log('last.fm username found: ', uname)
		db.updateUsername({_id:msg.author.id, 
				username:uname,
				discr:msg.author.discriminator,
				did:msg.author.username
		})
	}else{
		console.log('last.fm username does not exist.')
		msg.channel.send(`***${uname}*** does not exist.`)
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
		
	if (msg.content.search(/(\.nowplaying)/gmi)===0 || msg.content.search(/(\.np)/gmi)===0){
		var firstMention = msg.mentions.members.first()
		
		// if the person has mentioned a user, find the user 
		// in the DB 
		if(firstMention){
			db.findUsername({_id:firstMention.id}, getNowPlaying(sendNowPlaying(firstMention)(msg)))
		}else{
			// find the username in the message by finding the @tag
			db.findUsername({_id:msg.author.id}, getNowPlaying(sendNowPlaying(msg.author)(msg)))
		}
		console.log(`${uid} sent message`)
	
	} else if (msg.content.search(/.setFM/) === 0){
		// get the username
		uname = msg.content.replace(/(.setFM)[\s]+/gmi,'')
		uname = uname.replace(/[\n]*/g,'')
		console.log('PARSED USERNAME: ', uname)
		
		// we need to validate the username
		utils.validateUsername(uname)(usernameUpdate(msg))
	} else if(msg.content.search(/.testpack/gmi) === 0){
		msg.member.guild.members.forEach(member=>{
			if(member.user) {
				db.findUsername({_id:member.user.id}, getNowPlaying(sendNowPlaying(member.user.id)(msg)))
			}
		})
	}
	
})

// when you add a memeber to the database, add them to the database, -- admin can set their callsign 

client.on('guildMemberAdd', member => {
	console.log(member)
})

client.login(process.env.BOT_TOKEN)
