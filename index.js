const { app, BrowserWindow, ipcMain, Tray, Menu } = require("electron");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const cron = require("node-cron");
const AutoLaunch = require("auto-launch");
let tray = null;

let alert;
let win;

const userDataPath = app.getPath('userData');
const alarmsDir = path.join(userDataPath, 'alarm-log');
const pathToAlarms = path.join(alarmsDir, 'alarms.json');
const pathToConfigs = path.join(userDataPath, 'config.json');

function ensureDirectories() {
    if (!fs.existsSync(alarmsDir)) {
        fs.mkdirSync(alarmsDir, { recursive: true });
    }
}

function ensureFiles() {
    if (!fs.existsSync(pathToAlarms)) {
        fs.writeFileSync(pathToAlarms, JSON.stringify([]));
    }
    if (!fs.existsSync(pathToConfigs)) {
        const defaultConfigs = {
            autoHibernate: false
        };
        fs.writeFileSync(pathToConfigs, JSON.stringify(defaultConfigs, null, 2));
    }
}

function createWindow() {
    win = new BrowserWindow({
        title: "Care For Ever",
        width: 500,
        height: 650,
        resizable: false,
        darkTheme: true,
        icon: path.join(__dirname, 'icon', 'icon.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });
    win.setMenu(null);
    load_page('main');
    tray = new Tray(path.join(__dirname, 'icon', 'icon.png'));

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show App', click: () => {
                win.show();
            }
        },
        {
            label: 'Quit', click: () => {
                app.isQuiting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Care For Ever');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (win.isVisible()) {
            win.hide();
        } else {
            win.show();
        }
    });

    win.on('close', (event) => {
        if (!app.isQuiting) {
            event.preventDefault();
            win.hide();
        }
        return false;
    });
}

function load_page(page_name) {
    const filePath = path.join(__dirname, "components", "template.html");
    win.loadURL(`file://${filePath}?page=${page_name}.html`);
}

ipcMain.on('hibernate', () => {
    exec('shutdown /h');
});

ipcMain.on('shutdown', () => {
    exec('shutdown');
});

ipcMain.on('load_page', (event, page) => {
    const filePath = path.join(__dirname, "view", `${page}.html`);
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error("Error loading page:", err);
            event.reply('new_page_content', `<p style="color:red;">صفحه ${page} پیدا نشد!</p>`);
        } else {
            event.reply('new_page_content', data, page);
        }
    });
});

ipcMain.on('GetAlarms', (event) => {
    fs.readFile(pathToAlarms, 'utf8', (err, data) => {
        if (err) {
            event.reply('Alarms', ["ERR"]);
        } else {
            event.reply('Alarms', JSON.parse(data));
        }
    });
});

ipcMain.on('changeAlarmStatus', (event, status, index) => {
    fs.readFile(pathToAlarms, 'utf8', (err, data) => {
        if (err) {
            event.reply('Error', 'cant change alarm status');
        } else {
            try {
                const alarms = JSON.parse(data);
                if (alarms[index]) {
                    alarms[index].active = status;
                    fs.writeFile(pathToAlarms, JSON.stringify(alarms, null, 2), 'utf8', (err) => {
                        if (err) {
                            event.reply('Error', 'cant save updated alarms');
                        } else {
                            event.reply('Success', 'alarm status updated');
                            loadAndScheduleAlarms();
                        }
                    });
                } else {
                    event.reply('Error', 'invalid alarm index');
                }
            } catch {
                event.reply('Error', 'invalid JSON data');
            }
        }
    });
});

ipcMain.on('DeleteAlarm', (event, index) => {
    fs.readFile(pathToAlarms, 'utf8', (err, data) => {
        if (err) {
            event.reply('Error', 'cant change alarm status');
        } else {
            try {
                const alarms = JSON.parse(data);
                if (alarms[index]) {
                    alarms.splice(index, 1);
                    fs.writeFile(pathToAlarms, JSON.stringify(alarms, null, 2), 'utf8', (err) => {
                        if (err) {
                            event.reply('Error', 'cant delete alarm');
                        } else {
                            event.reply('AlarmDeleted', index);
                            loadAndScheduleAlarms();
                        }
                    });
                } else {
                    event.reply('Error', 'invalid alarm index');
                }
            } catch {
                event.reply('Error', 'invalid JSON data');
            }
        }
    });
});

ipcMain.on("AddAlarm", (event, name, hour, minute) => {
    fs.readFile(pathToAlarms, 'utf8', (err, data) => {
        if (err) {
            event.reply('Error', 'cant change alarm status');
        } else {
            try {
                const alarms = JSON.parse(data);
                alarms.push({
                    name: name,
                    time: [hour, minute],
                    active: true
                });
                fs.writeFile(pathToAlarms, JSON.stringify(alarms, null, 2), 'utf8', (err) => {
                    if (err) {
                        event.reply('Error', 'cant save alarm');
                    } else {
                        event.reply('Success', 'Alarm created');
                        loadAndScheduleAlarms();
                    }
                });
            } catch {
                event.reply('Error', 'invalid JSON data');
            }
        }
    });
});

ipcMain.on('GetConfigs', (event) => {
    fs.readFile(pathToConfigs, 'utf8', (err, data) => {
        if (!err) {
            event.reply('Configs', JSON.parse(data));
        }
    });
});

ipcMain.on('ChangeConfigs', (event, option, value) => {
    fs.readFile(pathToConfigs, 'utf8', (err, data) => {
        if (err) {
            event.reply('Error', 'cant change alarm status');
        } else {
            try {
                let configs = JSON.parse(data);
                if (configs.hasOwnProperty(option)) {
                    configs[option] = value;
                    fs.writeFile(pathToConfigs, JSON.stringify(configs, null, 2), 'utf8', (err) => {
                        if (err) {
                            event.reply('Error', 'cant save updated alarms');
                        } else {
                            event.reply('Success', 'alarm status updated');
                            loadAndScheduleAlarms();
                        }
                    });
                } else {
                    event.reply('Error', 'invalid alarm index');
                }
            } catch {
                event.reply('Error', 'invalid JSON data');
            }
        }
    });
});

let scheduledJobs = {};

function loadAndScheduleAlarms() {
    try {
        const data = fs.readFileSync(pathToAlarms, 'utf8');
        const alarms = JSON.parse(data);

        Object.values(scheduledJobs).forEach(job => job.stop());
        scheduledJobs = {};

        alarms.forEach((alarm, index) => {
            if (!alarm.active) return;

            let [hour, minute] = alarm.time;
            if (minute - 5 < 0) {
                hour = (hour - 1 + 24) % 24;
                minute = 60 + (minute - 5);
            } else {
                minute -= 5;
            }
            const cronExpression = `${minute} ${hour} * * *`;
            const job = cron.schedule(cronExpression, () => {
                do_alarm(alarm.name);
            });

            scheduledJobs[index] = job;
        });
    } catch (error) {
        console.error("Error scheduling alarms:", error);
    }
}

function do_alarm(name) {
    fs.readFile(pathToConfigs, 'utf8', (err, data) => {
        if (!err) {
            const configs = JSON.parse(data);
            if (configs.autoHibernate) {
                exec('shutdown /h');
            } else {
                alert = new BrowserWindow({
                    title: "Care For Ever - 5 Minuts Before",
                    width: 400,
                    height: 300,
                    resizable: false,
                    darkTheme: true,
                    icon: path.join(__dirname, 'icon', 'icon.png'),
                    webPreferences: {
                        nodeIntegration: true,
                        contextIsolation: false,
                        enableRemoteModule: true
                    }
                });
                alert.setMenu(null);
                const filePath = path.join(__dirname, "view", "alarm.html");
                alert.loadURL(`file://${filePath}`);
            }
        }
    });
}

ipcMain.on('close-alarm', () => {
    if (alert) alert.destroy();
});

const myAppLauncher = new AutoLaunch({
    name: 'Care for Ever',
    path: process.execPath,
});

app.whenReady().then(() => {
    ensureDirectories();
    ensureFiles();
    createWindow();
    loadAndScheduleAlarms();

    myAppLauncher.isEnabled()
        .then((isEnabled) => {
            if (!isEnabled) {
                myAppLauncher.enable();
            }
        })
        .catch((err) => {
            console.error("Auto-launch failed:", err);
        });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
