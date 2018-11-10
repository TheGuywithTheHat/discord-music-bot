const config = require('./config.json');
const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const youtube = require('googleapis').google.youtube({
    version: 'v3',
    auth: config.google_key
});
const client = new Discord.Client();

var channel;
var voiceConnection;
var dispatcher;

var queue = {
    q: [],
    current: null,
    add(q) {
        console.log('add ' + q);
        this.q.push(q);
        if (this.current === null) {
            playNext();
        }
    },
    next() {
        console.log('next');
        this.current = this.q.shift();
        return this.current;
    },
    stop(q) {
        console.log('stop');
        if (!q) {
            this.q = []
        } else {
            this.q = q;
        }
        this.current = null;
    },
    override(q) {
        console.log('override ' + q);
        if (this.current) {
            this.q.unshift(this.current);
        }
        this.q.unshift(q);
        playNext();
    },
}

client.on('ready', () => {
    console.log('I am ready!');
    channel = client.channels.get(config.command_channel);
    join();
});

client.on('message', respond);
client.login(config.user_token);

function respond(message) {
    console.log(message.content);
    var alexa = /this is so sad alexa play (.*)/i.exec(message.content);

    if (message.content == '!pause') {
        pause();
    } else if (message.content == '!play') {
        resume();
    } else if (message.content == '!stop') {
        stop();
    } else if (message.content == '!next') {
        try {
            dispatcher.end();
        } catch (err) {}
    } else if (message.content == '!q') {
        channel.send('"' + queue.q.join('", "') + '"');
    } else if (alexa) {
        queue.override(alexa[1]);
    } else if (message.content.startsWith('!play ')) {
        queue.override(message.content.substring(6));
    } else if (message.content.startsWith('!q ')) {
        queue.add(message.content.substring(3));
    }
}

function join() {
    client.channels.get(config.music_channel).join()
        .then(vc => {
            console.log('joined');
            voiceConnection = vc;
        }).catch(console.error);
}

function playNext() {
    console.log('attempting next');
    if (queue.q.length == 0) {
        return;
    }
    search(queue.next(), (err, res) => {
        if (err) console.error(err);
        
        if(res.data.items.length === 0) {
            channel.send('No results found for "' + q + '"');
        } else {
            url = 'https://www.youtube.com/watch?v=' + res.data.items[0].id.videoId;
            stream(url);
            channel.send('Now playing: ' + url);
        }
    });
}

function search(str, cb) {
    youtube.search.list({
        type: 'video',
        q: str,
        maxResults: 1,
        part: 'snippet',
    }, (err, res) => { cb(err, res); });
}

function stream(url) {
    /*try {
        dispatcher.end();
    } catch (err) {}*/
    var stream = ytdl(url, { filter : 'audioonly' });
    dispatcher = voiceConnection.playStream(stream, { volume: 0.01 });
    dispatcher.on('end', () => {
        console.log('nat end');
        queue.current = null;
        playNext();
    });
}

function stop() {
    try {
        dispatcher.end();
    } catch (err) {}
    queue.stop();
}

function resume() {
    try {
        dispatcher.resume();
    } catch (err) {}
}

function pause() {
    try {
        dispatcher.pause();
    } catch (err) {}
}