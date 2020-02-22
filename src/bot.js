require('dotenv').config()
const Discord = require('discord.js')
const db = require('./database.js')
const utils = require('./utils.js')
const i2a = require('image-to-ascii')
const fs = require('fs')

const ansi2json = require('ansi-to-json')
// create new discord client 
const client = new Discord.Client()

// function to send the picture
sendNowPlaying = id => msg => res => {
	if(!res){
		msg.channel.send("<@"+id+">"+" : No track currently playing...")
	}else{
	// send the message 
		console.log(id)
		client.fetchUser(id).then(user => {
				const embed = new Discord.RichEmbed()
				.setColor(0xA81E4F)
				.setTitle(user.username+'\'s Currently Playing')
				.addField('Track',`**${res.name}**`,true)
				.addField('Album',`**${res.album}**`,true)
				.addField('Scrobbles',`${res.scrobbles}`)
				.setAuthor('Juzzy','https://i.imgur.com/1DzHBNF.jpg')
				.setImage(res.image[3]['#text'])
				.setTimestamp()
				console.log(user.username)
				msg.channel.send(embed)
		
		}).catch(err => {
			console.log(err)	
		})

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

client.on('message', async msg => {
	// if the message does not belong to a user/guild do nothing 
	if (!msg.guild) return;
	
	// if the message is a bot message, ignore it 
	if (msg.author.bot) return;
	
	uid = msg.author.id
	console.log(`${uid} sent message`)
	
	// functionality to scrob all discord
	if(msg.content.search(/.npall/gmi) === 0){
		msg.member.guild.members.forEach(member=>{
			if(member.user) {
				console.log(member.user)
				db.findUsername({_id:member.user.id}, getNowPlaying(sendNowPlaying(member.user.id)(msg)))
			}
		})
	} else if (msg.content.search(/(\.nowplaying)/gmi)===0 || msg.content.search(/(\.np)/gmi)===0){
		var firstMention = msg.mentions.members.first()
		
		// if the person has mentioned a user, find the user in the DB 
		if(firstMention){
			db.findUsername({_id:firstMention.id}, getNowPlaying(sendNowPlaying(firstMention.id)(msg)))
		}else{
			// find the username in the message by finding the @tag
			db.findUsername({_id:msg.author.id}, getNowPlaying(sendNowPlaying(msg.author.id)(msg)))
		}
		console.log(`${uid} sent message`)
	
	} else if (msg.content.search(/.setFM/) === 0){
		// get the username
		uname = msg.content.replace(/(.setFM)[\s]+/gmi,'')
		uname = uname.replace(/[\n]*/g,'')
		console.log('PARSED USERNAME: ', uname)
		
		// we need to validate the username
		utils.validateUsername(uname)(usernameUpdate(msg))
	} else if(msg.content.search(/.pix/) === 0){
		subreddit = msg.content.replace(/(.pix)[\s]+/gmi,'')
		subreddit = subreddit.replace(/[\n]*/g,'')
		console.log(subreddit)

		getImage(subreddit, image => {
			if(!image){
				return msg.channel.send("**...finna no images to share...**")
			}
			const embed = new Discord.RichEmbed()
        	.setColor(0x00A2E8)
        	.setTitle(image.data.title)
			.setAuthor('Juzzy','https://i.imgur.com/1DzHBNF.jpg')
        	.setImage(image.data.url)
			.setTimestamp()
        	
			msg.channel.send(embed)	

			i2a(image.data.url, (err,res) => {
				if(err) console.log(err);

				// process the ascii object
				console.log(res.length)
				fs.writeFile("output.file", JSON.stringify(ansi2json(res)), err => {
					if(err) throw err;
					console.log("wrote file");
					
				})

				//msg.channel.send(res);

			})
		})


	} else if(msg.content.search(/.help/) === 0){
		const embed = new Discord.RichEmbed()
        .setColor(0xEBA94D)
		.setAuthor('Juzzy','https://i.imgur.com/1DzHBNF.jpg')
		.setThumbnail('https://i.imgur.com/xJvAZo0.png')
		.setTitle('Juzzy Help')
		.addField('.np','Display track currently playing (last.fm)')
		.addField('.np @user','Display track currently playing for a specific user (last.fm)')
		.addField('.npall','Display track currently playing for all registered users (last.fm)')
		.addField('.setFM <lastfm_username>','Set your last.fm username to enable last.fm functionality')
		.addField('.pix <subreddit>', 'Pull a random picture from a given subreddit')
		msg.channel.send(embed)	
		
	}
	
})

// when you add a memeber to the database, add them to the database 
client.on('guildMemberAdd', member => {
	console.log(member)
})

client.login(process.env.BOT_TOKEN)
