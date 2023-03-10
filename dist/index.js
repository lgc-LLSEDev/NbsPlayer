"use strict";
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/triple-slash-reference */
/* global ll mc Format PermType ParamType BinaryStream Packet Command CommandOrigin CommandOutput */
// LiteLoaderScript Dev Helper
/// <reference path="d:\Coding\bds\LLSEAids/dts/llaids/src/index.d.ts"/>
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const nbs_js_1 = require("@encode42/nbs.js");
const pluginName = 'NbsPlayer';
const pluginDataPath = `plugins/${pluginName}/`;
// const pluginCachePath = `${pluginDataPath}cache/`;
if (!fs.existsSync(pluginDataPath))
    fs.mkdirSync(pluginDataPath);
// if (!fs.existsSync(pluginCachePath)) fs.mkdirSync(pluginCachePath);
const { Red, White, Aqua, Yellow, Green, Gray, Gold, DarkAqua, LightPurple, DarkGreen, DarkBlue, } = Format;
const builtInInstruments = new Map([
    [0, 'note.harp'],
    [1, 'note.bassattack'],
    [2, 'note.bd'],
    [3, 'note.snare'],
    [4, 'note.hat'],
    [5, 'note.guitar'],
    [6, 'note.flute'],
    [7, 'note.bell'],
    [8, 'note.chime'],
    [9, 'note.xylobone'],
    [10, 'note.iron_xylophone'],
    [11, 'note.cow_bell'],
    [12, 'note.didgeridoo'],
    [13, 'note.bit'],
    [14, 'note.banjo'],
    [15, 'note.pling'],
]);
const bossBarId = 627752937; // NbsPlayer??????(xd
const playTasks = new Map();
function readNbs(name, callback) {
    const nbsPath = `${pluginDataPath}${name}`;
    fs.readFile(nbsPath, (err, data) => {
        if (err)
            callback(false, err.stack);
        else
            callback(true, (0, nbs_js_1.fromArrayBuffer)(data.buffer));
    });
}
function stopPlay(xuid, setNew) {
    const taskId = playTasks.get(xuid);
    if (taskId) {
        if (typeof taskId === 'object')
            clearInterval(taskId);
        if (setNew)
            playTasks.set(xuid, true);
        else
            playTasks.delete(xuid);
        const pl = mc.getPlayer(xuid);
        if (pl)
            pl.removeBossBar(bossBarId);
        return true;
    }
    return false;
}
function getPlaySoundDataPack(bs, sound, position, volume, pitch) {
    bs.reset();
    bs.writeString(sound);
    bs.writeVarInt(Math.round(position.x * 8));
    bs.writeUnsignedVarInt(Math.round(position.y * 8));
    bs.writeVarInt(Math.round(position.z * 8));
    bs.writeFloat(volume);
    bs.writeFloat(pitch);
    return bs.createPacket(86);
}
function startPlay(player, nbsName) {
    const { xuid } = player;
    const playingTask = playTasks.get(xuid);
    if (playingTask)
        stopPlay(xuid, true);
    player.setBossBar(bossBarId, `${Green}??????nbs????????????`, 100, 4);
    readNbs(nbsName, (ok, ret) => {
        if (!ok) {
            player.tell(`${Red}?????????????????????\n${ret}`, 0);
            player.removeBossBar(bossBarId);
            return;
        }
        if (!(ret instanceof nbs_js_1.Song))
            return;
        const { errors, meta: { name, author, originalAuthor }, length, instruments: { loaded: loadedIns }, layers, timePerTick, } = ret;
        if (errors.length > 0) {
            player.tell(`${Red}?????????????????????\n${errors.join('\n')}`, 0);
            player.removeBossBar(bossBarId);
            return;
        }
        let songDisplayName = Aqua;
        if (name) {
            songDisplayName += name;
            const displayAuthor = originalAuthor || author;
            if (displayAuthor)
                songDisplayName += `${White} - ${Green}${displayAuthor}`;
        }
        else
            songDisplayName += nbsName;
        const bossBarTxt = `${Green}??? ${LightPurple}NbsPlayer${Gray} | ${songDisplayName}`;
        const parsedNotes = [];
        for (const layer of layers) {
            parsedNotes.push(
            // eslint-disable-next-line no-loop-func
            layer.notes.map((n) => {
                const { instrument, velocity, key, pitch } = n;
                const { volume } = layer;
                const { key: insKey, builtIn, meta: { soundFile }, } = loadedIns[instrument];
                const finalKey = key + (insKey - 45) + pitch / 100;
                const insName = builtIn
                    ? builtInInstruments.get(instrument)
                    : soundFile.replace(/\.(ogg|mp3|wav)/g, '');
                return [
                    insName,
                    (velocity * volume) / 100,
                    2 ** ((finalKey - 45) / 12),
                ];
            }));
        }
        const totalLength = timePerTick * length;
        let passedTick = 0;
        let lastBossBarIndex = -1; // boss bar?????????0?????????-1??????????????????boss bar
        const startTime = Date.now();
        const bs = new BinaryStream();
        const task = () => {
            const timeSpent = Date.now() - startTime;
            const nowTick = Math.floor(timeSpent / timePerTick);
            if (nowTick <= passedTick)
                return;
            const passedInterval = nowTick - passedTick;
            passedTick = nowTick;
            const pl = mc.getPlayer(xuid);
            if (!(parsedNotes[0].length && pl)) {
                stopPlay(xuid);
                return;
            }
            const { pos } = pl;
            pos.y += 0.37;
            parsedNotes.forEach((layer) => {
                for (let i = 0; i < passedInterval; i += 1) {
                    const n = layer.shift();
                    if (n) {
                        const [insName, vol, pitch] = n;
                        if (insName)
                            pl.sendPacket(getPlaySoundDataPack(bs, insName, pos, vol, pitch));
                    }
                }
            });
            const bossBarIndex = Math.floor((timeSpent / totalLength) * 100);
            if (bossBarIndex !== lastBossBarIndex) {
                lastBossBarIndex = bossBarIndex;
                pl.setBossBar(bossBarId, bossBarTxt, bossBarIndex, 3);
            }
        };
        playTasks.set(xuid, setInterval(task, 0));
    });
}
/**
 * @param {Player} player
 */
function nbsForm(player) {
    const pageMax = 15;
    const musics = [];
    fs.readdirSync(pluginDataPath).forEach((v) => {
        if (v.toLowerCase().endsWith('.nbs'))
            musics.push(v);
    });
    if (musics.length === 0) {
        player.sendModalForm(`${Aqua}${pluginName}`, `${Green}???????????????????????????????????????????????????????????????nbs?????????????????????`, `?????????`, `?????????`, () => { });
        return;
    }
    const search = (param) => {
        const paramL = param.toLowerCase().replace(' ', '');
        const result = [];
        musics.forEach((v) => {
            if (v.toLowerCase().replace(' ', '').includes(paramL))
                result.push(v);
        });
        let form = mc.newSimpleForm();
        form = form
            .setTitle(`${Aqua}${pluginName}`)
            .setContent(`${Green}????????? ${Yellow}${result.length} ${Green}???` +
            `?????? ${Aqua}${param} ${Green}?????????`);
        result.forEach((v) => {
            form = form.addButton(`${DarkAqua}${v}`);
        });
        player.sendForm(form, (_, i) => {
            if (i !== null && i !== undefined) {
                startPlay(player, result[i]);
            }
        });
    };
    const sendForm = (page) => {
        const maxPage = Math.ceil(musics.length / pageMax);
        const index = pageMax * (page - 1);
        const pageContent = musics.slice(index, index + pageMax);
        let pageUp = false;
        let pageDown = false;
        let form = mc.newSimpleForm();
        form
            .setTitle(`${Aqua}${pluginName}`)
            .setContent(`${Green}?????? ${Yellow}${page} ${White}/ ${Gold}${maxPage} ${Gray}| ` +
            `${Green}?????? ${Yellow}${musics.length}`)
            .addButton(`${DarkBlue}??????`)
            .addButton(`${DarkBlue}??????`);
        if (page > 1) {
            form = form.addButton(`${DarkGreen}<- ?????????`);
            pageUp = true;
        }
        pageContent.forEach((v) => {
            form = form.addButton(`${DarkAqua}${v}`);
        });
        if (page < maxPage) {
            form = form.addButton(`${DarkGreen}????????? ->`);
            pageDown = true;
        }
        player.sendForm(form, (_, i) => {
            if (i !== null && i !== undefined) {
                if (i === 0) {
                    const searchForm = mc
                        .newCustomForm()
                        .setTitle(`${Aqua}${pluginName}`)
                        .addInput('?????????????????????');
                    player.sendForm(searchForm, (__, data) => {
                        if (data) {
                            const [param] = data;
                            if (param) {
                                search(param);
                            }
                            else
                                player.tell(`${Red}?????????????????????`);
                        }
                        else
                            sendForm(page);
                    });
                    return;
                }
                if (i === 1) {
                    if (maxPage < 2) {
                        player.sendModalForm(`${Aqua}${pluginName}`, `${Red}??????????????????2???????????????`, `?????????`, `?????????`, () => sendForm(page));
                        return;
                    }
                    const toPageForm = mc
                        .newCustomForm()
                        .setTitle(`${Aqua}${pluginName}`)
                        .addSlider('???????????????????????????', 1, maxPage, 1, page);
                    player.sendForm(toPageForm, (__, data) => {
                        if (data)
                            sendForm(data[0]);
                        else
                            sendForm(page);
                    });
                    return;
                }
                let fIndex = i - 2;
                if (pageUp) {
                    if (fIndex === 0) {
                        sendForm(page - 1);
                        return;
                    }
                    fIndex -= 1;
                }
                if (pageDown) {
                    if (fIndex === pageMax) {
                        sendForm(page + 1);
                        return;
                    }
                }
                startPlay(player, pageContent[fIndex]);
            }
        });
    };
    sendForm(1);
}
/**
 * ???????????????
 */
function trimQuote(str) {
    if (str && str.startsWith('"') && str.endsWith('"'))
        return str.slice(1, str.length - 1);
    return str;
}
(() => {
    const cmd = mc.newCommand('nbsplayer', '??????????????????', PermType.Any);
    cmd.setAlias('nbs');
    cmd.optional('filename', ParamType.RawText);
    cmd.overload(['filename']);
    cmd.setCallback((_, origin, out, result) => {
        const { player } = origin;
        if (!player) {
            out.error('??????????????????????????????');
            return false;
        }
        const { filename } = result;
        if (filename) {
            const filePath = `${pluginDataPath}${trimQuote(filename)}`;
            if (!fs.existsSync(filePath)) {
                out.error('??????????????????');
                return false;
            }
            startPlay(player, trimQuote(filename));
            return true;
        }
        nbsForm(player);
        return true;
    });
    cmd.setup();
})();
(() => {
    const cmd = mc.newCommand('nbsplay', '?????????????????????');
    cmd.mandatory('player', ParamType.Player);
    cmd.mandatory('filename', ParamType.String);
    cmd.optional('forcePlay', ParamType.Bool);
    cmd.overload(['player', 'filename', 'forcePlay']);
    cmd.setCallback(
    // @ts-expect-error ????????????
    (_, __, out, result) => {
        const { player, filename, forcePlay } = result;
        const trimmedFilename = trimQuote(filename);
        const filePath = `${pluginDataPath}${trimmedFilename}`;
        if (player.length === 0) {
            out.error('???????????????');
            return false;
        }
        if (!fs.existsSync(filePath)) {
            out.error('??????????????????');
            return false;
        }
        player.forEach((p) => {
            if (forcePlay || !playTasks.get(p.xuid)) {
                startPlay(p, trimmedFilename);
                out.success(`????????? ${p.name} ?????? ${filename}`);
                return;
            }
            out.error(`?????? ${p.name} ??????????????????????????????`);
        });
        return true;
    });
    cmd.setup();
})();
(() => {
    const cmd = mc.newCommand('nbstop', '????????????nbs', PermType.Any);
    cmd.overload();
    cmd.setCallback((_, origin, out) => {
        const { player } = origin;
        if (!player) {
            out.error('??????????????????????????????');
            return false;
        }
        if (stopPlay(player.xuid))
            return out.success('????????????');
        out.error('????????????');
        return false;
    });
    cmd.setup();
})();
(() => {
    const cmd = mc.newCommand('nbsisplaying', '????????????????????????', PermType.Any);
    cmd.overload();
    cmd.setCallback((_, origin, out) => {
        const { player } = origin;
        if (!player) {
            out.error('??????????????????????????????');
            return false;
        }
        if (playTasks.get(player.xuid))
            return out.success('true');
        out.error('false');
        return false;
    });
    cmd.setup();
})();
mc.listen('onLeft', (pl) => stopPlay(pl.xuid));
ll.registerPlugin(pluginName, '??????????????????NBS?????????', [1, 0, 1], {
    Author: 'student_2333',
    License: 'Apache-2.0',
});
