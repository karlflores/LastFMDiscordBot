require('dotenv').config()
var LastFMNode = require('lastfm').LastFmNode	

const lastfm = new LastFMNode({
	api_key: process.env.LFM_API_KEY,
	secret: process.env.LFM_SECRET
})


const username = 'farlklores'

// get the track that is currently playing
// either pass the track payload if there is 
// a currently playing track or null if there is not 
getNowPlaying = callback => user => {
	method = 'user.getRecentTracks'
	options = {
		limit: 1,
		user,
		handlers: {
			success: data => {
				npTrack = data.recenttracks.track[0]
				if(npTrack['@attr'] != undefined && npTrack['@attr']){
					console.log(npTrack)
					getTrackScrobbles(user)(npTrack)(callback)
				}else{
					callback(null)
				}
			},
			error : err => {
				console.error(err)
			}
		}
	}	
	lastfm.request(method, options)
}

getTrackScrobbles = username => track => callback => {
	method = 'track.getInfo'
	console.log(track.name, track.artist['#text'])
	options = {
		track: track.name,
		artist: track.artist['#text'],
		username,
		handlers: {
			success: data => {
				var payload = {
					username,
					name: data.track.name,
					scrobbles: data.track.userplaycount,
					artist: track.artist['#text'],
					album: track.album['#text'],
					image: track.image
				}
				callback(payload)
			},
			error: err => {
				console.error(err)
			}
		}
	}
	req = lastfm.request(method, options)
}

getNowPlaying('farlklores', console.log)

module.exports = {
	getNowPlaying
}
