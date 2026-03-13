import makeWASocket, { 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    DisconnectReason, 
    downloadContentFromMessage 
} from "@whiskeysockets/baileys"
import pino from "pino"
import chalk from "chalk"
import moment from "moment"

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info")
    const { version } = await fetchLatestBaileysVersion()
    
    const sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: "silent" }), // Terminal auto-bersih
        printQRInTerminal: true,
        browser: ["Bot Anto", "Chrome", "1.0.0"]
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update
        if (connection === "open") {
            console.log(chalk.green("✅ BOT ANTO AKTIF! Terminal Bersih & RVO Siap Tempur."));
        }
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut)
            if (shouldReconnect) startBot()
        }
    })

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0]
        if (!msg.message) return
        
        const sender = msg.key.remoteJid
        const fromMe = msg.key.fromMe
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ""
        const cmd = text.toLowerCase().trim()

        // --- FUNGSI DOWNLOAD MEDIA (MESIN UTAMA) ---
        const downloadMedia = async (mediaObj) => {
            const type = mediaObj.imageMessage ? "imageMessage" : "videoMessage"
            const stream = await downloadContentFromMessage(mediaObj[type], type.replace('Message', ''))
            let buffer = Buffer.from([])
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk])
            }
            return { buffer, type, caption: mediaObj[type].caption || "" }
        }

        // --- 1. FITUR OTOMATIS (Tanpa Perintah) ---
        const isVO = msg.message?.viewOnceMessageV2 || msg.message?.viewOnceMessageV2Extension
        if (isVO && !fromMe) {
            console.log(chalk.magenta(`📸 [AUTO-RVO] Mendeteksi media rahasia dari: ${sender}`))
            try {
                const { buffer, type, caption } = await downloadMedia(isVO.message)
                const out = `✨ *AUTO-RVO ANTO* ✨\n💬 Cap: ${caption}`
                if (type === 'imageMessage') {
                    await sock.sendMessage(sender, { image: buffer, caption: out }, { quoted: msg })
                } else {
                    await sock.sendMessage(sender, { video: buffer, caption: out }, { quoted: msg })
                }
            } catch (e) { console.log("Gagal auto-download") }
        }

        // --- 2. FITUR MANUAL (.rvo dengan Reply) ---
        if (cmd === ".rvo") {
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
            if (!quoted) return await sock.sendMessage(sender, { text: "❌ Reply fotonya dulu, To!" })

            const vo = quoted.viewOnceMessageV2 || quoted.viewOnceMessageV2Extension || quoted
            const media = vo.message || vo
            
            if (media.imageMessage || media.videoMessage) {
                console.log(chalk.yellow(`📸 [MANUAL-RVO] Menarik paksa media...`))
                try {
                    const { buffer, type, caption } = await downloadMedia(media)
                    const out = `✨ *HASIL TARIK PAKSA ANTO* ✨\n💬 Cap: ${caption}`
                    if (type === 'imageMessage') {
                        await sock.sendMessage(sender, { image: buffer, caption: out }, { quoted: msg })
                    } else {
                        await sock.sendMessage(sender, { video: buffer, caption: out }, { quoted: msg })
                    }
                } catch (e) {
                    await sock.sendMessage(sender, { text: "❌ Gagal! Mungkin sudah kadaluwarsa." })
                }
            } else {
                await sock.sendMessage(sender, { text: "❌ Itu bukan foto/video sekali lihat!" })
            }
        }

        // --- MENU ---
        if (cmd === ".menu") {
            const menuText = `📜 *BOT ANTO HP VIVO* 📜\n\n` +
                             `> *.rvo* (Reply pesan sekali lihat)\n` +
                             `> *.ping* (Cek bot)\n` +
                             `> *.time* (Cek jam)\n\n` +
                             `💡 *Auto-RVO:* ON (Otomatis tarik)`
            await sock.sendMessage(sender, { text: menuText })
        } else if (cmd === ".ping") {
            await sock.sendMessage(sender, { text: "Pong! 🏓 Bot standby." })
        } else if (cmd === ".time") {
            await sock.sendMessage(sender, { text: `⌚ Jam: ${moment().format("HH:mm:ss")} WIB` })
        }

        if (cmd) console.log(chalk.cyan(`[${moment().format("HH:mm")}]`), chalk.white(`${sender}: ${text}`))
    })
}

startBot()

