require('dotenv').config()
const Discord = require('discord.js')
const db = require('./database.js')
const utils = require('./utils.js')
const LRUCache = require('./LRUCache.js')
const fastLev = require('fast-levenshtein')
const fs = require('fs')
// create new discord client 
const client = new Discord.Client()
const cache = new LRUCache();


// load the countries json object
countries_str = fs.readFileSync('./src/countries.json')
countries = JSON.parse(countries_str)
country_dict = {}
countries.forEach( c => {
	country_dict[c.name.common] = c	
})

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


	} else if(msg.content.search(/.covidm/) === 0){
		console.log("finding stats....")
		utils.getCovidOverview(res => {
			table = create_covid_mobile_table(res)
			console.log(table)
			console.log(table.length)
			const b = '```'
			msg.channel.send(`${b}prolog\n${table}${b}`)
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
	} else if(msg.content.search(/.cvr/) === 0){
		// get the username
		country = msg.content.replace(/(.cvr)[\s]+/gmi,'')
		country = country.replace(/[\n]*/g,'')
		console.log('PARSED USERNAME: ', country)
		utils.getCovidOverview(res => {
			table = find_covid_region_stat(country,res)
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
		.addField('.np !<@user>','Send through the track a specific user is currently scrobbling [default: message sender]')
		.addField('.npall','Send through the tracks all registered users in the discord are currently scrobbling')
		.addField('.npc @user','Send through the track you are currently scrobbling as well as the mentioned users scobble number for that track')
		.addField('.tracks !<@user>','Get the top 10 tracks for a given user [default: message sender]')
		.addField('.albums !<@user>','Get the top 10 albums for a given user [default: message sender]')
		.addField('.artists @opt<@user>','Get the top 10 artists for a given user [default: message sender]')
		.addField('.setFM <lastfm_username>','Set your lastFM username to enable lastFM functionality')
		.addField('.pix <subreddit>', 'Pull a random picture from a given subreddit')
		.addField('.covid', 'Get the a table if the current COVID-19 statistics')
		.addField('.covidm', 'Get the a table if the current COVID-19 statistics - suitable for mobile viewing')
		.addField('.cvc <CCA2|CCA3|COUNTRY_QUERY>', 'Get COVID-19 statistics for a specified country, can use 2/3-Letter countrt codes, or search for a countries name (some auto-correct, but not guaranteed to give right country')
		.addField('.cvr <REGION_QUERY>', 'Get COVID-19 statistics for a specified region [AMERICAS, OCEANIA, ASIA, EUROPE, AFRICA]')
		msg.channel.send(embed)	
		
	}
	
})

generate_spaces = num => {
	string = ''
	for(i = 0 ; i < num ; i++) string += ' '
	return string;
}

evaluate_country = (country,i) => {
		var total = 0;
		var incr = 30;
		for(j = 0 ; j < country.length && country.length > 1 ; j++){
			if(country[j] == i.country.toLowerCase()[j]){
				if( j == 0) total+=(30-j)
				else total++
			}
		}
		
		if(i.country.toLowerCase().search(country) > -1){
				console.log('match ' + i.country)
				total += country.length
		}

		return total - fastLev.get(country, i.country.toLowerCase())

}

find_countries_region = (region) => {
	res = [] 
	Object.keys(country_dict).forEach(key => {
		if(country_dict[key].name.common == "United States") country = "USA"
		else if(country_dict[key].name.common == "United Kingdom") country = "UK"
		else if(country_dict[key].name.common == "South Korea") country = "S. Korea"
		else if(country_dict[key].name.common == "DR Congo") country = "DRC"
		else if(country_dict[key].name.common == "Republic of the Congo") country = "Congo"
		else if(country_dict[key].name.common == "United Arab Emirates") country = "UAE"
		else if(country_dict[key].name.common == "Macau") country = "Macao"
		else country = country_dict[key].name.common
		if(country_dict[key].region.toLowerCase() === region.toLowerCase()) res.push(country)
	})

	return res
}

find_covid_region_stat = (region, table) => {

	// find the best countries 
	countries = find_countries_region(region)	
	console.log(countries)
	const ascii_table_end = "+----------------+---------+--------+--------+---------+\n"
	const ascii_table_headers = "| COUNTRY        | CASES   | +cases | DEATHS | +deaths |\n"
	const ascii_title = "|                       COVID-19                       |\n"
	const spaces = {
		country: 14,
		cases: 7,
		d_cases: 6,
		deaths:6,
		d_deaths:7
	}
	var rows = [];
	
	countries.forEach( c => {
		table.forEach( r => {
			if(r.country.toLowerCase() === c.toLowerCase()) rows.push(r)
		})	
	})
	if(countries.length === 0) return []
	// if there is a country that matches the country, then we will use that country 
	
	rows = rows.sort( (r1,r2) => {
		return Number(r2.cases.replace(',','')) - Number(r1.cases.replace(',','')) 
	})
	rows = rows.filter( i => rows.indexOf(i) < 10)
		
	var ascii_table = ascii_table_end + ascii_title + ascii_table_end + ascii_table_headers +ascii_table_end;
	rows.forEach(r => {

		if(r.country.length > spaces.country) r.country = r.country.substring(0,spaces.country)
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

// get two and three letter country codes

find_country_2 = (cc2) => {
	if(cc2.toLowerCase() === "uk") return "UK"
	if(cc2.toLowerCase() === "sk") return "S. Korea"
	if(cc2.toLowerCase() === "us") return "USA"
	res = [] 
	Object.keys(country_dict).forEach(key => {
		if(country_dict[key].cca2 == "US") country = "USA"
		else if(country_dict[key].cca2 == "GB" || cc2 == "UK") country = "UK"
		else if(country_dict[key].cca2 == "KR" || cc2 == "SK") country = "S. Korea"
		else if(country_dict[key].cca2 == "CD") country = "DRC"
		else if(country_dict[key].cca2 == "CG") country = "Congo"
		else if(country_dict[key].cca2 == "AE") country = "UAE"
		else if(country_dict[key].cca2 == "MO") country = "Macao"
		else country = country_dict[key].name.common

		if(cc2.toLowerCase() === country_dict[key].cca2.toLowerCase()) res.push(country)
	})
	if(res.length > 0) return res[0]
	if(res.length > 0) return res[0]
	console.log(res)
	console.log(res)
	return null
}
find_country_3 = (cc2) => {
	if(cc2.toLowerCase() === "usa") return "USA"
	res = [] 
	Object.keys(country_dict).forEach(key => {
		if(country_dict[key].cc3 == "USA") country = "USA"
		else if(country_dict[key].cca3 == "GBR") country = "UK"
		else if(country_dict[key].cca3 == "KOR") country = "S. Korea"
		else if(country_dict[key].cca3 == "COD") country = "DRC"
		else if(country_dict[key].cca3 == "COG") country = "Congo"
		else if(country_dict[key].cca3 == "ARE") country = "UAE"
		else if(country_dict[key].cca3 == "MAC") country = "Macao"
		else country = country_dict[key].name.common

		if(cc2.toLowerCase() === country_dict[key].cca3.toLowerCase()) res.push(country)
	})
	if(res.length > 0) return res[0]
	console.log(res)
	return null
}

find_covid_country_stat = (country, table) => {

	// find the best countries 
	
	const ascii_table_end = "+----------------+---------+--------+--------+---------+\n"
	const ascii_table_headers = "| COUNTRY        | CASES   | +cases | DEATHS | +deaths |\n"
	const ascii_title = "|                       COVID-19                       |\n"
	const spaces = {
		country: 14,
		cases: 7,
		d_cases: 6,
		deaths:6,
		d_deaths:7
	}
	var rows;
	// find the country 
	if(country.length == 2){
		// 
		country = find_country_2(country)
		if(!country) rows = []
		else rows = table.filter(i => country === i.country)
	}else if(country.length == 3){
		country = find_country_3(country)
		console.log(country)
		if(!country) rows = []
		else rows = table.filter(i => country === i.country)
	}else{
		rows = table.sort((i,j) => {
				res1 = evaluate_country(country,i) 
				res2 = evaluate_country(country,j)
				if(res1 < res2) return 1
				else if(res1 === res2) return 0
				else return -1
		})
		rows = rows.filter( i => rows.indexOf(i) < 1)
	}
	if(rows.length == 0) rows = table.filter(i => fastLev.get(i.country.toLowerCase(), country) < 5)
	
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

	const ascii_table_end = "+----------------+---------+--------+--------+---------+\n"
	const ascii_table_headers = "| COUNTRY        | CASES   | +cases | DEATHS | +deaths |\n"
	const ascii_title = "|                       COVID-19                       |\n"
	const spaces = {
		country: 14,
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
create_covid_mobile_table = table => {
	rows = table.filter( i => table.indexOf(i) < 20);
	const ascii_table_end =        "+-----+---------+--------+\n"
	const ascii_table_middle =     "+.....+.........+........+\n"
	const ascii_table_headers =    "| WHO | CASES   | DEATHS |\n"
	const ascii_title =            "|        COVID-19        |\n"
	const spaces = {
		country: 3,
		cases: 7,
		deaths:6,
		d_deaths:6,
		d_cases: 7,
	}
	var ascii_table = ascii_table_end + ascii_title + ascii_table_end + ascii_table_headers +ascii_table_end;
	rows.forEach(r => {
		if(r.country === "S. Korea") country = "South Korea"
		else if(r.country === "USA") country = "United States"
		else if(r.country === "UK") country = "United Kingdom"
		else if(r.country == "Diamond Princess") country = "DP"
		else if(r.country == "Total:") country = "ALL";
		else country = r.country
		// get the country code 
		//console.log(r.country)
		country_code = country_dict[country]
		if(country_code) country_code = country_code.cca3
		else{
			country_code = country
			console.log("NO MATCH FOR: " + country)
		}

		ascii_table += "| " 
		ascii_table += country_code;
		ascii_table += generate_spaces(spaces.country - country_code.length) + ' '
		ascii_table += "| "
		ascii_table += r.cases;
		ascii_table += generate_spaces(spaces.cases - r.cases.length) + ' '
		ascii_table += "| " 
		ascii_table += r.deaths;
		ascii_table += generate_spaces(spaces.deaths - r.deaths.length) + ' '
		ascii_table += "|\n"
		ascii_table += "| " 
		ascii_table += generate_spaces(spaces.country) + ' '
		ascii_table += "| " 
		ascii_table += r.new_cases;
		ascii_table += generate_spaces(spaces.d_cases - r.new_cases.length) + ' '
		ascii_table += "| " 
		ascii_table += r.new_deaths;
		ascii_table += generate_spaces(spaces.d_deaths - r.new_deaths.length) + ' '
		ascii_table += "|\n"
		ascii_table += ascii_table_end

	})
	ascii_table += ascii_table_end
	var r = table[table.length -1]
		ascii_table += "| " 
		ascii_table += "ALL";
		ascii_table += generate_spaces(spaces.country - r.country.length) + ' '
		ascii_table += "| "
		ascii_table += r.cases;
		ascii_table += generate_spaces(spaces.cases - r.cases.length) + ' '
		ascii_table += "| " 
		ascii_table += r.deaths;
		ascii_table += generate_spaces(spaces.deaths - r.deaths.length) + ' '
		ascii_table += "|\n"
	ascii_table += ascii_table_end
	
	console.log(ascii_table.length)
	return ascii_table;
}
		utils.getCovidOverview(res => {
			table = create_covid_mobile_table(res)
			//console.log(table)
		})

// when you add a memeber to the database, add them to the database 
client.on('guildMemberAdd', member => {
	console.log(member)
})

client.login(process.env.BOT_TOKEN)
