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
var dispatcher = { end(){ playNext(); }, pause(){}, resume(){}};

var queue = {
    q: [],
    current: null,
    add(q) {
        console.log('add ' + q);
        this.q.push(q);
        if (this.current == null) {
            playNext();
        }
    },
    getNext() {
        console.log('next');
        return this.q.shift();
    },
    clear() {
        this.q = [];
    },
    override(q) {
        if (this.current != null) {
            this.q.unshift(this.current);
        }
        this.q.unshift(q);
        end();
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
    } else if (message.content in ['!play', '!paly']) {
        resume();
    } else if (message.content == '!stop') {
        stop();
    } else if (message.content == '!reset') {
        if (queue.current != null) {
            queue.q.unshift(queue.current);
        }
        client.channels.get(config.music_channel).leave();
        join(playNext);
    } else if (message.content == '!next') {
        end();
    } else if (message.content == '!q') {
        channel.send('"' + queue.q.join('", "') + '"');
    } else if (alexa) {
        queue.override(alexa[1]);
    } else if (message.content.startsWith('!play ') || message.content.startsWith('!paly ')) {
        queue.override(message.content.substring(6));
    } else if (message.content.startsWith('!q ')) {
        queue.add(message.content.substring(3));
    }
}

function join(cb) {
    client.channels.get(config.music_channel).join()
        .then(vc => {
            vc.on('error', (err) => {
                console.log(err);
            });
            console.log('joined');
            voiceConnection = vc;
            if (cb) cb();
        }).catch(console.error);
}

function playNext() {
    console.log('attempting next');
    if (queue.q.length == 0) {
        return;
    }
    search(queue.getNext(), (err, res) => {
        if (err) console.log(err);
        
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
    var stream = ytdl(url, { filter: 'audioonly', highWaterMark: 1<<25 });
    queue.current = url;
    dispatcher = voiceConnection.playStream(stream, { volume: 0.1 });
    dispatcher.on('end', () => {
        console.log('nat end');
        queue.current = null;
        dispatcher = { end(){ playNext(); }, pause(){}, resume(){} };
        playNext();
    });
    dispatcher.on('error', err => console.log(err));
}

function stop() {
    queue.clear();
    end();
}

function resume() {
    try {
        dispatcher.resume();
    } catch (err) { console.log(err); }
}

function pause() {
    try {
        dispatcher.pause();
    } catch (err) { console.log(err); }
}

function end() {
    try {
        dispatcher.end();
    } catch (err) { console.log(err); }
}
