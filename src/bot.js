require('dotenv').config()
const Discord = require('discord.js')
const db = require('./database.js')
const utils = require('./utils.js')
const LRUCache = require('./LRUCache.js')
const fastLev = require('fast-levenshtein')

// create new discord client 
const client = new Discord.Client()
const cache = new LRUCache();

createTrackChartEmbed = (user, tracks) => {
	const embed = new Discord.RichEmbed()
	.setColor(0xA81E4F)
	.setTitle(user.username+'\'s Top Tracks')
	.setAuthor('Juzzy','https://i.imgur.com/1DzHBNF.jpg')
	.setTimestamp()
	
	message = "";
	tracks.forEach(track => {
		console.log(track)
		message += `${track['@attr'].rank}. **${track.name}**  - ${track.artist['#text']} | Scrobbles: ${track.playcount}\n\n`
	})
	embed.setDescription(message)
	return embed	
}
createArtistChartEmbed = (user, artists) => {
	const embed = new Discord.RichEmbed()
	.setColor(0xA81E4F)
	.setTitle(user.username+'\'s Top Artists')
	.setAuthor('Juzzy','https://i.imgur.com/1DzHBNF.jpg')
	.setTimestamp()
	message = "";

	artists.forEach(artist => {
		message += `${artist['@attr'].rank}. **${artist.name}** | Scrobbles: ${artist.playcount}\n\n`
	})
	embed.setDescription(message)
	return embed	
}

createAlbumChartEmbed = (user, albums) => {
	const embed = new Discord.RichEmbed()
	.setColor(0xA81E4F)
	.setTitle(user.username+'\'s Top Albums')
	.setAuthor('Juzzy','https://i.imgur.com/1DzHBNF.jpg')
	.setTimestamp()

	message = "";
	albums.forEach(album => {
		message += `${album['@attr'].rank}. **${album.name}** - ${album.artist['#text']} | Scrobbles: ${album.playcount}\n\n`
	})
	embed.setDescription(message)
	return embed	
}

// function to send the picture
sendNowPlaying = id => msg => res => {
	if(!res){
		client.fetchUser(id).then(user => {
				const embed = new Discord.RichEmbed()
				.setColor(0xA81E4F)
				.setTitle(user.username+' : No track currently playing...')
				.setAuthor('Juzzy','https://i.imgur.com/1DzHBNF.jpg')
				.setTimestamp()
				console.log(user.username)
				msg.channel.send(embed)	
		}).catch(err => {
			console.log(err)
		})
	}else{
	// send the message 
		console.log(id)
		client.fetchUser(id).then(user => {
				const embed = new Discord.RichEmbed()
				.setColor(0xA81E4F)
				.setTitle(user.username+'\'s Currently Playing')
				.addField('Track',`**${res.name}**`,true)
				.addField('Album',`**${res.album}**`,true)
				.addField('Artist',`**${res.artist}**`,true)
				.setImage(res.image[3]['#text'])
				.addField('Scrobbles',`${res.scrobbles}`)
				.setAuthor('Juzzy','https://i.imgur.com/1DzHBNF.jpg')
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

				if(cache.get(member.user.id)){
					getNowPlaying(sendNowPlaying(member.user.id)(msg))(cache.get(member.user.id))
					console.log("fetch cache item... " + cache.get(member.user.id))
				}else{
					db.findUsername({_id:member.user.id}, cache, getNowPlaying(sendNowPlaying(member.user.id)(msg)))
					console.log("set cache item... " + member.user.id)
				}
			}
		})
	}else if(msg.content.search(/.npc/gmi) === 0){
		console.log("NPW CALLED")
		let authorTrack = null;
		let mentionTrack = null;
			
		// after we get the author track, we can get the number of scrobs for the mentioned user
		let getMentionScrobs = function(){
			var firstMention = msg.mentions.members.first()
			if(!firstMention){
				const embed = new Discord.RichEmbed()
				.setColor(0xA81E4F)
				.setTitle("ERROR: Mention a user to compare scrobbles...")
				.setAuthor('Juzzy','https://i.imgur.com/1DzHBNF.jpg')
				.setTimestamp()
				msg.channel.send(embed)		
			}else{
				// if there is a user mentioned fetch lastFM username 
				if(cache.get(firstMention.id)){
					getScrobbleNum(cache.get(firstMention.id))(authorTrack)(res => {
						mentionTrack = res;

						const embed = new Discord.RichEmbed()
						.setColor(0xA81E4F)
						.setTitle(msg.author.username+'\'s Currently Playing')
						.addField('Track',`**${authorTrack.name}**`,true)
						.addField('Album',`**${authorTrack.album}**`,true)
						.addField('Artist',`**${authorTrack.artist}**`,true)
						.addBlankField()
						.setImage(authorTrack.image[3]['#text'])
						.addField(`Scrobbles: ${msg.author.username}`,`${authorTrack.scrobbles}`,true)
						.addField(`Scrobbles: ${firstMention.user.username}`,`${res.scrobbles}`,true)
						.setAuthor('Juzzy','https://i.imgur.com/1DzHBNF.jpg')
						.setTimestamp()
						msg.channel.send(embed)	
						// now we can create the embed and send it 
					})
				}else{
					// fetch author track and add to the scrob holder 
					db.findUsername({_id:firstMention.id}, cache, username => {
						// for the given user name find the track 
						getScrobbleNum(username)(authorTrack)(res => {
							mentionTrack = res;
								const embed = new Discord.RichEmbed()
								.setColor(0xA81E4F)
								.setTitle(msg.author.username+'\'s Currently Playing')
								.addField('Track',`**${authorTrack.name}**`,true)
								.addField('Album',`**${authorTrack.album}**`,true)
								.addField('Artist',`**${authorTrack.artist}**`,true)
								.addBlankField()
								.setImage(authorTrack.image[3]['#text'])
								.addField(`Scrobbles: ${msg.author.username}`,`${authorTrack.scrobbles}`,true)
								.addField(`Scrobbles: ${firstMention.user.username}`,`${res.scrobbles}`,true)
								.setAuthor('Juzzy','https://i.imgur.com/1DzHBNF.jpg')
								.setTimestamp()
								msg.channel.send(embed)	
						})
					})

				}
				
			}
		}
		// get the author's now playing track
		if(cache.get(msg.author.id)){
			getNowPlaying(res => {
				if(!res){
					const embed = new Discord.RichEmbed()
					.setColor(0xA81E4F)
					.setTitle(msg.author.username+': No track currently playing...')
					.setAuthor('Juzzy','https://i.imgur.com/1DzHBNF.jpg')
					.setTimestamp()
					msg.channel.send(embed)	
					return;					
				}
				authorTrack = res;
				getMentionScrobs()
				
			})(cache.get(msg.author.id))
		
		}else{
			// fetch author track and add to the scrob holder 
			db.findUsername({_id:msg.author.id}, cache, getNowPlaying(res => {
				authorTrack = res;
				if(!res){
					const embed = new Discord.RichEmbed()
					.setColor(0xA81E4F)
					.setTitle(msg.author.username+': No track currently playing...')
					.setAuthor('Juzzy','https://i.imgur.com/1DzHBNF.jpg')
					.setTimestamp()
					msg.channel.send(embed)	
					return;					
				}
				getMentionScrobs();
			}))

		}
	} else if (msg.content.search(/(\.nowplaying)/gmi)===0 || msg.content.search(/(\.np)/gmi)===0){
		console.log("NP CALLED")
		var firstMention = msg.mentions.members.first()
		
		// if the person has mentioned a user, find the user in the DB 
		if(firstMention){
			if(cache.get(firstMention.id)){
				getNowPlaying(sendNowPlaying(firstMention.id)(msg))(cache.get(firstMention.id))
				console.log("fetch cache item... " + cache.get(firstMention.id))
				
			}else{
				db.findUsername({_id:firstMention.id}, cache, getNowPlaying(sendNowPlaying(firstMention.id)(msg)))
				console.log("set cache item... " + firstMention.id)
			}
		}else{
			// find the username in the message by finding the @tag
			if(cache.get(msg.author.id)){
				getNowPlaying(sendNowPlaying(msg.author.id)(msg))(cache.get(msg.author.id))
				console.log("fetch cache item... " + cache.get(msg.author.id))
			}else {
				db.findUsername({_id:msg.author.id}, cache, getNowPlaying(sendNowPlaying(msg.author.id)(msg)))
				console.log("set cache item... " + msg.author.id)
			}
		}
		console.log(`${uid} sent message`)
	
	} else if(msg.content.search(/.albums/) === 0){
		var firstMention = msg.mentions.members.first()
		
		// if the person has mentioned a user, find the user in the DB 
		if(firstMention){
			if(cache.get(firstMention.id)){
				getAlbumChart(res=>{
					albums = res.weeklyalbumchart.album
					albums = albums.filter( i => albums.indexOf(i) < 10)
					msg.channel.send(createAlbumChartEmbed(firstMention.user, albums))
				})(cache.get(firstMention.id))
				
			}else{
				db.findUsername({_id:firstMention.id}, cache, getAlbumChart(res => {
					albums = res.weeklyalbumchart.album
					albums = albums.filter( i => albums.indexOf(i) < 10)
					msg.channel.send(createAlbumChartEmbed(firstMention.user, albums))
				}))
			}
		}else{
			// find the username in the message by finding the @tag
			if(cache.get(msg.author.id)){
				getAlbumChart(res => { 		
					albums = res.weeklyalbumchart.album
					albums = albums.filter( i => albums.indexOf(i) < 10)
					msg.channel.send(createAlbumChartEmbed(msg.author, albums))
			})(cache.get(msg.author.id))
				console.log("fetch cache item... " + cache.get(msg.author.id))
			}else {
				db.findUsername({_id:msg.author.id}, cache, getAlbumChart(res => {		
						albums = res.weeklyalbumchart.album
						albums = albums.filter( i => albums.indexOf(i) < 10)
						msg.channel.send(createAlbumChartEmbed(msg.author, albums))
				}))
				console.log("set cache item... " + msg.author.id)
			}
		}
		console.log(`${uid} sent message`)
		
	} else if(msg.content.search(/.artists/) === 0){
		var firstMention = msg.mentions.members.first()
		// if the person has mentioned a user, find the user in the DB 
		if(firstMention){
			if(cache.get(firstMention.id)){
				getArtistChart(res=>{
					artists = res.weeklyartistchart.artist
					artists = artists.filter( i => artists.indexOf(i) < 10)
					msg.channel.send(createArtistChartEmbed(firstMention.user, artists))
				})(cache.get(firstMention.id))
				
			}else{
				db.findUsername({_id:firstMention.id}, cache, getArtistChart(res => {
					artists = res.weeklyartistchart.artist
					artists = artists.filter( i => artists.indexOf(i) < 10)
					msg.channel.send(createArtistChartEmbed(firstMention.user, artists))
				}))
			}
		}else{
			// find the username in the message by finding the @tag
			if(cache.get(msg.author.id)){
				getArtistChart(res=>{
					artists = res.weeklyartistchart.artist
					artists = artists.filter( i => artists.indexOf(i) < 10)
					msg.channel.send(createArtistChartEmbed(msg.author, artists))
			})(cache.get(msg.author.id))
				console.log("fetch cache item... " + cache.get(msg.author.id))
			}else {
				db.findUsername({_id:msg.author.id}, cache, getArtistChart(res => {		
					artists = res.weeklyartistchart.artist
					artists = artists.filter( i => artists.indexOf(i) < 10)
					msg.channel.send(createArtistChartEmbed(msg.author, artists))
				}))
				console.log("set cache item... " + msg.author.id)
			}
		}
		console.log(`${uid} sent message`)

	} else if(msg.content.search(/.tracks/) === 0){	
		var firstMention = msg.mentions.members.first()
		// if the person has mentioned a user, find the user in the DB 
		if(firstMention){
			if(cache.get(firstMention.id)){
				getTrackChart(res=>{
					tracks = res.weeklytrackchart.track
					tracks = tracks.filter( i => tracks.indexOf(i) < 10)
					msg.channel.send(createTrackChartEmbed(firstMention.user, tracks))
				})(cache.get(firstMention.id))
				
			}else{
				db.findUsername({_id:firstMention.id}, cache, getTrackChart(res => {
					tracks = res.weeklytrackchart.track
					tracks = tracks.filter( i => tracks.indexOf(i) < 10)
					msg.channel.send(createTrackChartEmbed(firstMention.user, tracks))
				}))
			}
		}else{
			// find the username in the message by finding the @tag
			if(cache.get(msg.author.id)){
				getTrackChart(res=>{
					tracks = res.weeklytrackchart.track
					tracks = tracks.filter( i => tracks.indexOf(i) < 10)
					msg.channel.send(createTrackChartEmbed(msg.author, tracks))
			})(cache.get(msg.author.id))
				console.log("fetch cache item... " + cache.get(msg.author.id))
			}else {
				db.findUsername({_id:msg.author.id}, cache, getTrackChart(res => {		
					tracks = res.weeklytrackchart.track
					tracks = tracks.filter( i => tracks.indexOf(i) < 10)
					msg.channel.send(createTrackChartEmbed(msg.author, tracks))
				}))
				console.log("set cache item... " + msg.author.id)
			}
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
		})


	} else if(msg.content.search(/.covid/) === 0){
		console.log("finding stats....")
		utils.getCovidOverview(res => {
			table = create_covid_ascii_table(res)
			console.log(table)
			console.log(table.length)
			const b = '```'
			msg.channel.send(`${b}prolog\n${table}${b}`)
		})

	} else if(msg.content.search(/.cvc/) === 0){
		// get the username
		country = msg.content.replace(/(.cvc)[\s]+/gmi,'')
		country = country.replace(/[\n]*/g,'')
		console.log('PARSED USERNAME: ', country)
		utils.getCovidOverview(res => {
			table = find_covid_country_stat(country,res)
			console.log(table)
			console.log(table.length)
			const b = '```'
			msg.channel.send(`${b}prolog\n${table}${b}`)
		})

		// now we need to go through each of the countrys in the table and print the result out	
	} else if(msg.content.search(/.help/) === 0){
		const embed = new Discord.RichEmbed()
        .setColor(0xEBA94D)
		.setAuthor('Juzzy','https://i.imgur.com/1DzHBNF.jpg')
		.setThumbnail('https://i.imgur.com/xJvAZo0.png')
		.setTitle('Juzzy Help')
		.addField('.np','Send through the track you are currently scrobbling')
		.addField('.np @user','Send through the track a specific user is currently scrobbling')
		.addField('.npall','Send through the tracks all registered users in the discord are currently scrobbling')
		.addField('.npc @user','Send through the track you are currently scrobbling as well as the mentioned users scobble number for that track')
		.addField('.setFM <lastfm_username>','Set your lastFM username to enable lastFM functionality')
		.addField('.pix <subreddit>', 'Pull a random picture from a given subreddit')
		msg.channel.send(embed)	
		
	}
	
})

generate_spaces = num => {
	string = ''
	for(i = 0 ; i < num ; i++) string += ' '
	return string;
}

find_covid_country_stat = (country, table) => {

	// find the best countries 
	
	const ascii_table_end = "+----------------+---------+--------+--------+---------+\n"
	const ascii_table_headers = "| COUNTRY        | CASES   | +cases | DEATHS | +deaths |\n"
	const ascii_title = "|                      COVID-19                     |\n"
	const spaces = {
		country: 14,
		cases: 7,
		d_cases: 6,
		deaths:6,
		d_deaths:7
	}
	var rows;
	// find the country 
	
	rows = table.filter(i => {
				var total = 0;
				for(j = 0 ; j < country.length && country.length > 1 ; j++){
					if(country[j] == i.country.toLowerCase()[j]){
						if( j == 0 || j == 1) total+= 2
						else total++
					}
				}
				
				if(i.country.toLowerCase().search(country) > -1){
						console.log('match')
						total += country.length
				}
				return total >= country.length;		
		}).filter(i => fastLev.get(i.country.toLowerCase(), country) < 4)

	if(rows.length == 0) rows = table.filter(i => fastLev.get(i.country.toLowerCase(), country) < 5)
	rows = rows.filter( i => rows.indexOf(i) < 3)
	
	// if there is a country that matches the country, then we will use that country 
	

	
	var ascii_table = ascii_table_end + ascii_title + ascii_table_end + ascii_table_headers +ascii_table_end;
	rows.forEach(r => {
		ascii_table += "| " 
		ascii_table += r.country;
		ascii_table += generate_spaces(spaces.country - r.country.length) + ' '
		ascii_table += "| "
		ascii_table += r.cases;
		ascii_table += generate_spaces(spaces.cases - r.cases.length) + ' '
		ascii_table += "| " 
		ascii_table += r.new_cases;
		ascii_table += generate_spaces(spaces.d_cases - r.new_cases.length) + ' '
		ascii_table += "| " 
		ascii_table += r.deaths;
		ascii_table += generate_spaces(spaces.deaths - r.deaths.length) + ' '
		ascii_table += "| "
		ascii_table += r.new_deaths;
		ascii_table += generate_spaces(spaces.d_deaths - r.new_deaths.length) + ' '
		ascii_table += "|\n"
	})
	ascii_table += ascii_table_end
	console.log(ascii_table.length)
	return ascii_table;
}
create_covid_ascii_table = table => {
	rows = table.filter( i => table.indexOf(i) < 20);

	const ascii_table_end = "+-------------+---------+--------+--------+---------+\n"
	const ascii_table_headers = "| COUNTRY     | CASES   | +cases | DEATHS | +deaths |\n"
	const ascii_title = "|                      COVID-19                     |\n"
	const spaces = {
		country: 11,
		cases: 7,
		d_cases: 6,
		deaths:6,
		d_deaths:7
	}
	var ascii_table = ascii_table_end + ascii_title + ascii_table_end + ascii_table_headers +ascii_table_end;
	rows.forEach(r => {
		ascii_table += "| " 
		ascii_table += r.country;
		ascii_table += generate_spaces(spaces.country - r.country.length) + ' '
		ascii_table += "| "
		ascii_table += r.cases;
		ascii_table += generate_spaces(spaces.cases - r.cases.length) + ' '
		ascii_table += "| " 
		ascii_table += r.new_cases;
		ascii_table += generate_spaces(spaces.d_cases - r.new_cases.length) + ' '
		ascii_table += "| " 
		ascii_table += r.deaths;
		ascii_table += generate_spaces(spaces.deaths - r.deaths.length) + ' '
		ascii_table += "| "
		ascii_table += r.new_deaths;
		ascii_table += generate_spaces(spaces.d_deaths - r.new_deaths.length) + ' '
		ascii_table += "|\n"
	})
	ascii_table += ascii_table_end
	var r = table[table.length -1]
		ascii_table += "| " 
		ascii_table += r.country;
		ascii_table += generate_spaces(spaces.country - r.country.length) + ' '
		ascii_table += "| "
		ascii_table += r.cases;
		ascii_table += generate_spaces(spaces.cases - r.cases.length) + ' '
		ascii_table += "| " 
		ascii_table += r.new_cases;
		ascii_table += generate_spaces(spaces.d_cases - r.new_cases.length) + ' '
		ascii_table += "| " 
		ascii_table += r.deaths;
		ascii_table += generate_spaces(spaces.deaths - r.deaths.length) + ' '
		ascii_table += "| "
		ascii_table += r.new_deaths;
		ascii_table += generate_spaces(spaces.d_deaths - r.new_deaths.length) + ' '
		ascii_table += "|\n"
	ascii_table += ascii_table_end
	
	console.log(ascii_table.length)
	return ascii_table;
}

console.log(fastLev.get('korea','s. korea'))
// when you add a memeber to the database, add them to the database 
client.on('guildMemberAdd', member => {
	console.log(member)
})

client.login(process.env.BOT_TOKEN)
