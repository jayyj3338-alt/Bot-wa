import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys"
import chalk from "chalk"
import readline from "readline"
import moment from "moment"

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text) => new Promise((resolve) => rl.question(text, resolve))

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info")
    const { version } = await fetchLatestBaileysVersion()
    const sock = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: false
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut)
            console.log(chalk.red("❌ Koneksi putus, reconnecting..."))
            if (shouldReconnect) startBot()
        } else if (connection === "open") {
            console.log(chalk.green("✅ Bot Connected!"))
        }
    })

    // Generate pairing code kalau belum login
    if (!sock.authState.creds.registered) {
        const phoneNumber = await question("Masukkan nomor WhatsApp (format 62xxx): ")
        const code = await sock.requestPairingCode(phoneNumber.trim())
        console.log(chalk.greenBright(`📲 Pairing Code untuk ${phoneNumber}:`), chalk.yellow(code))
    }

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0]
        if (!msg.message || msg.key.fromMe) return
        const sender = msg.key.remoteJid
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ""

        console.log(`[${moment().format("HH:mm:ss")}] ${sender}: ${text}`)

        if (text === ".menu") {
            await sock.sendMessage(sender, { text: "📜 Menu Bot:\n\n.ping\n.menu\n.owner" })
        } else if (text === ".ping") {
            await sock.sendMessage(sender, { text: "🏓 Pong! Bot aktif bro" })
        } else if (text === ".owner") {
            await sock.sendMessage(sender, { text: "👑 Owner: wa.me/6285797329052" })
        }
    })
}

startBot()
