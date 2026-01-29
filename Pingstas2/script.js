// ==========================================
// 1. KONFIGURATION & DEBUGGING
// ==========================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Hilfsfunktion: Bilder laden
function loadImage(path) {
    const img = new Image();
    img.src = path;
    img.onload = () => console.log("✅ Bild geladen: " + path);
    img.onerror = () => console.warn("❌ FEHLER: Bild nicht gefunden: " + path);
    return img;
}

// Hilfsfunktion: Audio laden
function loadAudio(path, volume = 0.5, loop = false) {
    const audio = new Audio(path);
    audio.volume = volume;
    audio.loop = loop;
    audio.onerror = () => console.warn("❌ FEHLER: Audio nicht gefunden: " + path);
    return audio;
}

// Canvas Größe anpassen
function resizeGame() {
    const gameRatio = canvas.width / canvas.height;
    const windowRatio = window.innerWidth / window.innerHeight;
    let newWidth, newHeight;

    if (windowRatio < gameRatio) {
        newWidth = window.innerWidth;
        newHeight = newWidth / gameRatio;
    } else {
        newHeight = window.innerHeight;
        newWidth = newHeight * gameRatio;
    }

    canvas.style.width = newWidth + "px";
    canvas.style.height = newHeight + "px";
}
// Startgröße festlegen (wichtig für die interne Auflösung)
canvas.width = 400; 
canvas.height = 600;
window.addEventListener('resize', resizeGame);
resizeGame(); 

// ==========================================
// 2. RESSOURCEN LADEN (Basierend auf deinem Screenshot)
// ==========================================

// BILDER (Alle .webp und im assets Ordner [1])
const characterImg = loadImage("assets/3DPingsta.webp"); 
const aliceImg     = loadImage("assets/Alice.webp");       
const schnitzelImg = loadImage("assets/Schnitzel.webp"); 
const chainsawImg  = loadImage("assets/chainsaw.webp"); 
const ak47Img      = loadImage("assets/AK47.webp");

// AUDIO (Alle im Hauptverzeichnis [1])
// "LIEBLOS.mp3" scheint deine neue Hintergrundmusik zu sein
const bgMusic = loadAudio("LIEBLOS.mp3", 0.6, true); 
const bossMusic = loadAudio("NIEMAND.mp3", 0.7, true);
// Langer Dateiname exakt übernommen:
const fatalityAudio = loadAudio("Fatality (Mortal Kombat) - QuickSounds.com.mp3", 0.5);
const shotAudio = loadAudio("shot.mp3", 0.3);
const chainsawAudio = loadAudio("chainsaw.mp3", 0.3, true);

// ==========================================
// 3. SPIEL-VARIABLEN
// ==========================================

const STATE_MENU        = 0; 
const STATE_READY       = 1; 
const STATE_PLAYING     = 2; 
const STATE_BOSS_INTRO  = 3; 
const STATE_BOSS_FIGHT  = 4; 
const STATE_GAMEOVER    = 5; 

let currentState = STATE_MENU;
let frames = 0;
let score = 0;           
let coinsCollected = 0;  
let highScore = localStorage.getItem("pingstaHighscore") || 0;
let gameOverTimer = 0; 

// Gameplay
let pipesSpawnedCount = 0;   
let hasChainsaw = false;     
let hasAK47 = false;         
let invincibilityTimer = 0;  
let activeItem = null;       
let lostWeapon = null;       

// WICHTIG: Boss kommt nach 5 Röhren (damit du kurz spielen kannst)
const BOSS_TRIGGER_SCORE = 5; 

// Boss Variablen
let introTaps = 0; 
let penguinHealth = 3;
let alice = { x: 0, y: 0, w: 120, h: 120, dy: 2, hp: 100, active: false };
let schnitzels = []; 

// Steuerung
let moveUp = false, moveDown = false, moveLeft = false, moveRight = false;
let bullets = [];
let shootTimer = 0; 

const restartBtn = { x: canvas.width - 120, y: 10, w: 110, h: 40 };

const levels = {
    easy:   { gap: 200, speed: 2.0, color: "#00FF99" }, 
    normal: { gap: 170, speed: 2.8, color: "#FFaa00" }, 
    hard:   { gap: 140, speed: 3.5, color: "#FF0055" }  
};
let currentLevel = levels.normal;

// Listen für Objekte
let explosionParticles = []; 
let screenDrips = [];  
let coinsCollection = []; 
let pipesPosition = []; 

// Touch Steuerkreuz (D-Pad)
const dPad = {
    x: 70, y: 520, size: 40,
    up: { ox: 0, oy: -50 },
    down: { ox: 0, oy: 50 },
    left: { ox: -50, oy: 0 },
    right: { ox: 50, oy: 0 }
};

// ==========================================
// 4. ZEICHNEN & UI
// ==========================================

function drawUI() {
    // Titel und Score immer sichtbar, außer im Menü speziell
    if (currentState === STATE_MENU) {
        drawBloodyTitle();
        ctx.fillStyle = "white"; ctx.font = "16px Arial"; ctx.textAlign = "center";
        ctx.fillText("Wähle Schwierigkeit:", canvas.width/2, 300);
        drawButton("EASY", 50, 330, 80, 35, levels.easy.color);
        drawButton("NORMAL", 160, 330, 80, 35, levels.normal.color);
        drawButton("HARD", 270, 330, 80, 35, levels.hard.color);
    } 
    else if (currentState === STATE_READY) {
        drawBloodyTitle();
        ctx.fillStyle = "#FFD700"; ctx.strokeStyle = "black"; ctx.lineWidth = 3; ctx.textAlign = "center";
        ctx.font = "30px Arial Black"; ctx.strokeText("BEREIT?", canvas.width/2, 350); ctx.fillText("BEREIT?", canvas.width/2, 350);
        ctx.fillStyle = "white"; ctx.font = "14px Arial"; ctx.fillText("(Tippen zum Starten)", canvas.width/2, 390);
    } 
    else if (currentState === STATE_PLAYING || currentState === STATE_BOSS_FIGHT) {
        // Score oben links
        ctx.fillStyle = "white"; ctx.strokeStyle = "black"; ctx.lineWidth = 3; ctx.textAlign = "left";
        ctx.font = "30px Arial Black"; ctx.strokeText(score, 15, 40); ctx.fillText(score, 15, 40);
        
        // Münzen
        drawCoin(25, 70); 
        ctx.fillStyle = "#FFD700"; ctx.font = "bold 20px Arial"; 
        ctx.fillText(coinsCollected, 45, 76); ctx.strokeText(coinsCollected, 45, 76);
        
        // Lebensanzeige (Herzen) im Bosskampf
        if (currentState === STATE_BOSS_FIGHT) {
            ctx.fillStyle = "red"; ctx.strokeStyle = "white"; ctx.lineWidth = 1;
            for(let i=0; i<penguinHealth; i++) {
                ctx.beginPath(); ctx.arc(canvas.width - 30 - (i*25), 40, 8, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            }
        }
    } 
    else if (currentState === STATE_GAMEOVER) {
        updateAndDrawBlood();
        drawFatalitySequence();
    }
}

function drawBloodyTitle() {
    const centerX = canvas.width / 2;
    const topY = 60; 
    ctx.save();
    ctx.textAlign = "center";
    ctx.shadowColor = "#FF0000"; ctx.shadowBlur = 15;
    ctx.fillStyle = "black"; ctx.font = "bold 40px Arial Black"; ctx.fillText("PINGSTA'S", centerX + 2, topY + 2); 
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#FF0000"; ctx.fillText("PINGSTA'S", centerX, topY);
    ctx.fillRect(centerX - 100, topY + 5, 4, 15); ctx.fillRect(centerX + 80, topY + 5, 5, 25);
    ctx.fillStyle = "#FFF"; ctx.font = "bold 18px Arial"; ctx.fillText("REKORD: " + highScore, centerX, topY + 35);
    ctx.restore();
}

function drawButton(text, x, y, w, h, color) {
    ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "black"; ctx.font = "bold 14px Arial"; ctx.textAlign = "center"; ctx.fillText(text, x + w/2, y + h/2 + 5);
}

function drawFatalitySequence() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.save();
    ctx.textAlign = "center";
    ctx.shadowColor = "black"; ctx.shadowBlur = 10;

    if (gameOverTimer < 90) { 
        ctx.fillStyle = "#FF0055"; ctx.font = "bold 45px 'Courier New'"; 
        let shakeX = (Math.random() - 0.5) * 10; let shakeY = (Math.random() - 0.5) * 10;
        ctx.fillText("Ha Ha Haaaa!", cx + shakeX, cy + shakeY);
    } 
    else if (gameOverTimer < 180) {
        if (gameOverTimer === 90) {
            safePlay(fatalityAudio);
        }
        ctx.fillStyle = "#8a0303"; ctx.font = "60px cursive"; ctx.fillText("FATALITY!", cx, cy);
    }
    else {
        ctx.font = "60px cursive"; ctx.lineWidth = 4; ctx.strokeStyle = "black"; ctx.fillStyle = "#e3dac9"; 
        ctx.strokeText("GAME OVER", cx, cy - 30); ctx.fillText("GAME OVER", cx, cy - 30);
        ctx.font = "30px cursive"; ctx.fillStyle = "white"; ctx.lineWidth = 1; ctx.fillText("Score: " + score, cx, cy + 20);
        
        // Neustart Button
        ctx.shadowBlur = 0; ctx.fillStyle = "#222"; ctx.fillRect(restartBtn.x, restartBtn.y, restartBtn.w, restartBtn.h);
        ctx.strokeStyle = "#FF0055"; ctx.lineWidth = 2; ctx.strokeRect(restartBtn.x, restartBtn.y, restartBtn.w, restartBtn.h);
        ctx.fillStyle = "#FFF"; ctx.font = "bold 16px Arial"; ctx.fillText("NEUSTART", restartBtn.x + restartBtn.w/2, restartBtn.y + 25);
    }
    ctx.restore();
}

function updateAndDrawBlood() {
    for (let i = 0; i < explosionParticles.length; i++) {
        let p = explosionParticles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.size *= 0.95; 
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        if (p.size < 0.5) { explosionParticles.splice(i, 1); i--; }
    }
    ctx.fillStyle = "rgba(180, 0, 0, 0.85)"; 
    for (let i = 0; i < screenDrips.length; i++) {
        let d = screenDrips[i];
        if (d.h < d.maxH) d.h += d.speed;
        ctx.beginPath(); ctx.roundRect(d.x, d.y, d.w, d.h, 5); ctx.fill();
    }
}

// ==========================================
// 5. OBJEKTE (PINGUIN, BOSS, WAFFEN)
// ==========================================

const bird = {
    x: 50, y: 200, w: 40, h: 50, velocity: 0, gravity: 0.25, jumpStrength: 4.6,
    
    draw: function() {
        if (currentState === STATE_GAMEOVER) return; 
        
        ctx.save();
        ctx.translate(this.x + this.w/2, this.y + this.h/2);
        
        // Flackern bei Unverwundbarkeit
        if (invincibilityTimer > 0 && Math.floor(frames / 4) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        // Rotation nur beim Springen/Fallen
        if (currentState === STATE_PLAYING) {
            ctx.rotate(Math.min(Math.PI/4, Math.max(-Math.PI/4, (this.velocity*0.1))));
        }
        
        // Pinguin spiegeln (damit er nach rechts guckt)
        ctx.scale(-1, 1); 

        if (characterImg.complete && characterImg.naturalHeight !== 0) {
            ctx.drawImage(characterImg, -this.w/2, -this.h/2, this.w, this.h);
        } else {
            ctx.fillStyle = "#FFF"; ctx.beginPath(); ctx.ellipse(0, 0, this.w/2, this.h/2, 0, 0, Math.PI*2); ctx.fill();
        }

        // Waffen zeichnen
        if (hasChainsaw || hasAK47) {
            let bobbing = Math.sin(frames * 0.2) * 3;
            let img = hasChainsaw ? chainsawImg : ak47Img;

            if (img.complete && img.naturalHeight !== 0) {
                ctx.save();
                // Waffe spiegeln und positionieren
                ctx.scale(-1, 1); 
                
                if (hasAK47) {
                     ctx.drawImage(img, 10, -5 - bobbing, 60, 30);
                     // Mündungsfeuer
                     if (frames % 8 < 3 && currentState !== STATE_BOSS_INTRO) {
                         ctx.fillStyle = "#FFFF00"; ctx.globalAlpha = 0.8; ctx.beginPath();
                         ctx.arc(70, -5 - bobbing, 8 + Math.random()*5, 0, Math.PI*2); ctx.fill();
                     }
                } else {
                    ctx.drawImage(img, 5, -5 - bobbing, 50, 30); 
                }
                ctx.restore();
            }
        }
        ctx.restore();
    },
    
    update: function() {
        if (currentState === STATE_PLAYING) {
            this.velocity += this.gravity;
            this.y += this.velocity;
            
            // Boden-Kollision
            if (this.y + this.h >= canvas.height) { 
                this.y = canvas.height - this.h; gameOver(); 
            }
        } 
        else if (currentState === STATE_BOSS_FIGHT) {
            // RPG Flug-Modus
            let speed = 4;
            if (moveUp) this.y -= speed;
            if (moveDown) this.y += speed;
            if (moveLeft) this.x -= speed;
            if (moveRight) this.x += speed;

            // Grenzen
            if (this.y < 0) this.y = 0;
            if (this.y > canvas.height - this.h) this.y = canvas.height - this.h;
            if (this.x < 0) this.x = 0;
            if (this.x > canvas.width - this.w) this.x = canvas.width - this.w;
        }

        if (invincibilityTimer > 0) invincibilityTimer--;
    },
    jump: function() { this.velocity = -this.jumpStrength; }
};

const background = {
    draw: function() {
        // DA KEIN BILD VORHANDEN IST: Farbverlauf zeichnen
        let grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, "#1a002e"); // Oben dunkel
        grad.addColorStop(0.5, "#4a004e"); // Mitte lila
        grad.addColorStop(1, "#000000"); // Unten schwarz
        ctx.fillStyle = grad; 
        ctx.fillRect(0,0, canvas.width, canvas.height);

        // Roter Schimmer bei Game Over
        if (currentState === STATE_GAMEOVER) {
            ctx.fillStyle = `rgba(100, 0, 0, ${Math.min(0.6, gameOverTimer * 0.005)})`;
            ctx.fillRect(0,0, canvas.width, canvas.height);
        }
    },
    update: function() {} // Kein Scrolling nötig
};

// ==========================================
// 6. LOGIK UND UPDATES
// ==========================================

function update() {
    if (currentState === STATE_BOSS_INTRO) return; 

    bird.update();
    background.update();
    
    if (currentState === STATE_PLAYING) {
        updateLevelLogic();
    } else if (currentState === STATE_BOSS_FIGHT) {
        updateBossLogic();
    }
    
    // Herunterfallende Waffe animieren
    if (lostWeapon) {
        lostWeapon.x += lostWeapon.vx; lostWeapon.y += lostWeapon.vy;
        lostWeapon.vy += 0.5; lostWeapon.rotation += 0.3; 
        if (lostWeapon.y > canvas.height + 50) lostWeapon = null;
    }
    
    // Kettensägen Sound Loop
    if (currentState === STATE_PLAYING || currentState === STATE_BOSS_FIGHT) {
        updateBullets();
        if (hasChainsaw) safePlay(chainsawAudio);
        else safePause(chainsawAudio);
    } else {
        safePause(chainsawAudio);
    }

    frames++;
    if (currentState === STATE_GAMEOVER) gameOverTimer++;
}

function draw() {
    try {
        background.draw();
        
        if (currentState !== STATE_GAMEOVER || gameOverTimer < 5) {
            // Röhren zeichnen
            for (let i = 0; i < pipesPosition.length; i++) {
                let p = pipesPosition[i];
                let bottomY = p.y + currentLevel.gap; 
                ctx.fillStyle = "#000"; ctx.fillRect(p.x, 0, 20, p.y);
                drawChainsawTurbine(p.x + 10, p.y); // Oben
                ctx.fillStyle = "#000"; ctx.fillRect(p.x, bottomY, 20, canvas.height - bottomY);
                drawChainsawTurbine(p.x + 10, bottomY); // Unten
            }
            // Items & Coins
            for (let i = 0; i < coinsCollection.length; i++) {
                drawCoin(coinsCollection[i].x, coinsCollection[i].y);
            }
            if (activeItem) drawItem(activeItem);
        }

        if (currentState === STATE_BOSS_FIGHT || currentState === STATE_BOSS_INTRO) {
            drawAliceAndSchnitzel();
            drawDPadOverlay(); 
        }

        if (lostWeapon) drawLostWeapon();
        drawBullets(); 
        bird.draw();
        
        drawUI();
    } catch(e) {
        console.error("Drawing Error:", e);
    }
}

// Hilfsfunktionen fürs Zeichnen
function drawAliceAndSchnitzel() {
    if (alice.active) {
        if (aliceImg.complete && aliceImg.naturalHeight !== 0) {
            ctx.drawImage(aliceImg, alice.x, alice.y, alice.w, alice.h);
        } else {
            // Fallback Lila Kasten
            ctx.fillStyle = "purple"; ctx.fillRect(alice.x, alice.y, alice.w, alice.h);
        }
        // HP Balken über Alice
        ctx.fillStyle = "red"; ctx.fillRect(alice.x, alice.y - 10, alice.w, 5);
        ctx.fillStyle = "green"; ctx.fillRect(alice.x, alice.y - 10, alice.w * (alice.hp/100), 5);
    }

    // Schnitzel zeichnen
    for (let s of schnitzels) {
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(frames * 0.1);
        if (schnitzelImg.complete && schnitzelImg.naturalHeight !== 0) {
            ctx.drawImage(schnitzelImg, -20, -20, 40, 40);
        } else {
            ctx.fillStyle = "brown"; ctx.beginPath(); ctx.arc(0,0, 15, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }
}

function drawDPadOverlay() {
    ctx.save();
    ctx.globalAlpha = 0.4; 
    ctx.fillStyle = "#FFF"; ctx.strokeStyle = "#000"; ctx.lineWidth = 2;

    const drawBtn = (ox, oy, label) => {
        ctx.beginPath(); ctx.arc(dPad.x + ox, dPad.y + oy, 20, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#000"; ctx.font = "12px Arial"; ctx.textAlign = "center"; 
        ctx.fillText(label, dPad.x + ox, dPad.y + oy + 4);
        ctx.fillStyle = "#FFF"; 
    };

    drawBtn(dPad.up.ox, dPad.up.oy, "▲");
    drawBtn(dPad.down.ox, dPad.down.oy, "▼");
    drawBtn(dPad.left.ox, dPad.left.oy, "◄");
    drawBtn(dPad.right.ox, dPad.right.oy, "►");

    if (currentState === STATE_BOSS_INTRO) {
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = "white"; ctx.shadowColor="black"; ctx.shadowBlur=4;
        ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
        ctx.fillText("ACHTUNG: BOSS KAMPF!", canvas.width/2, 150);
        ctx.font = "14px Arial"; ctx.fillText("Tippe 2x zum Starten", canvas.width/2, 180);
        ctx.fillStyle = "#FFFF00"; ctx.fillText(`(${introTaps}/2)`, canvas.width/2, 210);
    }
    ctx.restore();
}

function drawChainsawTurbine(x, y) {
    // Zeichnet das Hindernis (Sägeblatt)
    ctx.save(); ctx.translate(x, y); ctx.rotate(frames * 0.15); 
    ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI*2); ctx.fill();
    // Zähne
    ctx.fillStyle = "#888"; 
    for(let i=0; i<8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(15, -4, 8, 8);
    }
    ctx.restore();
}

function drawCoin(x, y) {
    ctx.save(); ctx.translate(x, y);
    let scaleX = Math.abs(Math.sin(frames * 0.05)); ctx.scale(scaleX, 1); 
    ctx.fillStyle = "#FFDD00"; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 2; ctx.stroke(); 
    ctx.fillStyle = "#FFAA00"; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#FFF"; ctx.font = "bold 16px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("$", 0, 1);
    ctx.restore();
}

function drawItem(item) {
    ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(frames * 0.05); 
    let alpha = 0.5 + 0.5 * Math.abs(Math.sin(frames * 0.1)); ctx.globalAlpha = alpha;
    let img = (item.type === "chainsaw") ? chainsawImg : ak47Img;
    if (img.complete && img.naturalHeight !== 0) { ctx.drawImage(img, -22, -22, 44, 44); } 
    else { ctx.fillStyle = "red"; ctx.fillRect(-20, -20, 40, 40); }
    ctx.restore();
}

function drawLostWeapon() {
    if (!lostWeapon) return;
    ctx.save(); ctx.translate(lostWeapon.x, lostWeapon.y); ctx.rotate(lostWeapon.rotation); 
    let img = (lostWeapon.type === "chainsaw") ? chainsawImg : ak47Img;
    if (img.complete && img.naturalHeight !== 0) {
        ctx.scale(-1, 1);
        ctx.drawImage(img, -27, -17, 54, 34); 
    } 
    ctx.restore();
}

// LOGIK FUNKTIONEN
function updateBullets() {
    // Automatisch schießen
    if (hasAK47 && (currentState === STATE_PLAYING || currentState === STATE_BOSS_FIGHT)) {
        shootTimer++;
        if (shootTimer > 8) { 
            shootTimer = 0;
            shotAudio.currentTime = 0; safePlay(shotAudio);
            let muzzleX = bird.x + bird.w + 20; 
            let muzzleY = bird.y + bird.h/2; 
            bullets.push({ x: muzzleX, y: muzzleY, vx: 12 });
        }
    }
    // Projektile bewegen
    for (let i = 0; i < bullets.length; i++) {
        let b = bullets[i];
        b.x += b.vx;
        // Boss Treffer
        if (alice.active) {
            if (b.x > alice.x && b.x < alice.x + alice.w && b.y > alice.y && b.y < alice.y + alice.h) {
                alice.hp -= 2; 
                triggerSmallBlood(b.x, b.y);
                bullets.splice(i, 1); i--;
                continue;
            }
        }
        if (b.x > canvas.width + 50) { bullets.splice(i, 1); i--; }
    }
}

function updateLevelLogic() {
    // Röhren spawnen
    if (pipesSpawnedCount < BOSS_TRIGGER_SCORE) {
        if (frames % Math.floor(140 / (currentLevel.speed/2.5)) === 0) {
            let min = 50, max = canvas.height - currentLevel.gap - 50;
            let spawnY = Math.random() * (max - min) + min;
            
            pipesPosition.push({ x: canvas.width, y: spawnY, passed: false });
            pipesSpawnedCount++;

            // Items spawnen
            if (pipesSpawnedCount === 1 && !hasChainsaw && !hasAK47) {
                 activeItem = { x: canvas.width + 25, y: spawnY + currentLevel.gap / 2, type: "chainsaw" };
            }
            else if (pipesSpawnedCount === 3) {
                 activeItem = { x: canvas.width + 25, y: spawnY + currentLevel.gap / 2, type: "ak47" };
            }
        }
    } else if (pipesPosition.length === 0 && currentState === STATE_PLAYING) {
        startBossIntro();
    }

    // Bewegung der Röhren
    for (let i = 0; i < pipesPosition.length; i++) {
        let p = pipesPosition[i]; p.x -= currentLevel.speed;
        let safe = 8;
        // Kollision mit Röhren
        if (bird.x+bird.w-safe > p.x && bird.x+safe < p.x+20) {
            if (bird.y+safe < p.y || bird.y+bird.h-safe > p.y+currentLevel.gap) {
                hitPlayer();
            }
        }
        if (p.x + 20 < bird.x && !p.passed) { score++; p.passed = true; }
        if (p.x < -100) { pipesPosition.shift(); i--; }
    }
    updateCollectibles();
}

function updateBossLogic() {
    if (!alice.active) return;
    // Alice schwebt
    alice.y += Math.sin(frames * 0.05) * 2;
    
    // Alice wirft Schnitzel
    if (frames % 60 === 0) { 
        schnitzels.push({
            x: alice.x, y: alice.y + alice.h/2, vx: -5 - (Math.random()*2), rotation: 0
        });
    }

    // Schnitzel Logik
    for (let i = 0; i < schnitzels.length; i++) {
        let s = schnitzels[i]; s.x += s.vx;
        let dist = Math.sqrt(((bird.x+bird.w/2) - s.x)**2 + ((bird.y+bird.h/2) - s.y)**2);
        if (dist < 40) {
            hitPlayer(true); 
            schnitzels.splice(i, 1); i--;
            continue;
        }
        if (s.x < -50) { schnitzels.splice(i, 1); i--; }
    }

    // Säge Schaden an Alice
    if (hasChainsaw) {
         if (bird.x + bird.w > alice.x && bird.y < alice.y + alice.h && bird.y + bird.h > alice.y) {
             alice.hp -= 1;
             triggerSmallBlood(alice.x, alice.y + alice.h/2);
         }
    }
    // Sieg
    if (alice.hp <= 0) {
        score += 1000; alert("ALICE BESIEGT! (+1000 Pkt)"); reset();
    }
}

function updateCollectibles() {
    if (activeItem) {
        activeItem.x -= currentLevel.speed;
        let dist = Math.sqrt(((bird.x+bird.w/2) - activeItem.x)**2 + ((bird.y+bird.h/2) - activeItem.y)**2);
        if (dist < 40) { 
            swapWeapon(activeItem.type === "chainsaw", activeItem.type === "ak47");
            activeItem = null; 
        } else if (activeItem.x < -50) activeItem = null;
    }
     for (let i = 0; i < coinsCollection.length; i++) {
        let c = coinsCollection[i]; c.x -= currentLevel.speed;
        let dist = Math.sqrt(((bird.x+bird.w/2) - c.x)**2 + ((bird.y+bird.h/2) - c.y)**2);
        if (dist < 35) { coinsCollected++; coinsCollection.splice(i, 1); i--; }
        else if (c.x < -50) { coinsCollection.splice(i, 1); i--; }
    }
}

function swapWeapon(newChainsaw, newAK) {
    if (hasChainsaw || hasAK47) {
        let oldType = hasChainsaw ? "chainsaw" : "ak47";
        lostWeapon = { x: bird.x + bird.w/2, y: bird.y + bird.h/2, vx: 5, vy: -6, rotation: 0, type: oldType };
        triggerSmallBlood(bird.x + bird.w/2, bird.y + bird.h/2);
    }
    hasChainsaw = newChainsaw; hasAK47 = newAK;
}

function hitPlayer(isBossHit = false) {
    if (invincibilityTimer > 0) return;

    if (isBossHit) {
        penguinHealth--;
        triggerSmallBlood(bird.x, bird.y);
        invincibilityTimer = 60;
        
        // Waffe wechseln bei Treffer
        if (hasAK47) swapWeapon(true, false); 
        else if (hasChainsaw) swapWeapon(false, true); 
        else swapWeapon(false, true); 
        
        if (penguinHealth <= 0) gameOver();
    } else {
        if (hasChainsaw || hasAK47) {
            hasChainsaw = false; hasAK47 = false;
            invincibilityTimer = 60; 
            triggerSmallBlood(bird.x + bird.w/2, bird.y + bird.h/2);
            lostWeapon = { x: bird.x, y: bird.y, vx: 5, vy: -6, rotation: 0, type: "ak47" }; 
        } else {
            gameOver();
        }
    }
}

function startBossIntro() {
    currentState = STATE_BOSS_INTRO;
    safePause(bgMusic);
    introTaps = 0;
    alice.active = true; alice.x = canvas.width - 150; alice.y = canvas.height / 2 - 60; alice.hp = 100;
}

function startBossFight() {
    currentState = STATE_BOSS_FIGHT;
    bossMusic.currentTime = 0; safePlay(bossMusic);
}

function gameOver() {
    currentState = STATE_GAMEOVER;
    gameOverTimer = 0; 
    safePause(bgMusic); safePause(bossMusic); safePause(chainsawAudio);
    for (let i = 0; i < 60; i++) { 
        explosionParticles.push({
            x: bird.x + bird.w/2, y: bird.y + bird.h/2,
            vx: (Math.random() - 0.5) * 15, vy: (Math.random() - 0.5) * 15,
            size: Math.random() * 6 + 2, color: (Math.random() > 0.5) ? "#8a0303" : "#FF0000"
        });
    }
    if (score > highScore) { highScore = score; localStorage.setItem("pingstaHighscore", highScore); }
}

function reset() {
    bird.y = 200; bird.velocity = 0;
    pipesPosition = []; coinsCollection = []; 
    explosionParticles = []; screenDrips = []; schnitzels = [];
    score = 0; coinsCollected = 0; frames = 0;
    
    pipesSpawnedCount = 0; 
    hasChainsaw = false; hasAK47 = false;
    activeItem = null; lostWeapon = null; 
    invincibilityTimer = 0; bullets = []; 
    penguinHealth = 3; alice.active = false;

    currentState = STATE_MENU; 
    safePause(bgMusic); safePause(bossMusic); safePause(chainsawAudio);
}

function safePlay(audio) {
    if (audio.paused) {
        let p = audio.play();
        if (p !== undefined) p.catch(e => {});
    }
}
function safePause(audio) {
    if (!audio.paused) audio.pause();
}

function triggerSmallBlood(x, y) {
    for (let i = 0; i < 15; i++) { 
        explosionParticles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
            size: Math.random() * 4 + 2, color: "#FF0000" 
        });
    }
}

// ==========================================
// 7. INPUT (Maus & Touch)
// ==========================================

function getMousePos(canvas, evt) {
    let rect = canvas.getBoundingClientRect();
    let scaleX = canvas.width / rect.width;
    let scaleY = canvas.height / rect.height;
    let clientX = evt.clientX;
    let clientY = evt.clientY;
    if(evt.touches && evt.touches.length > 0) {
        clientX = evt.touches.clientX;
        clientY = evt.touches.clientY;
    }
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function handleTap(e) {
    let mouse = getMousePos(canvas, e);

    // Intro -> Boss
    if (currentState === STATE_BOSS_INTRO) {
        introTaps++;
        if (introTaps >= 2) startBossFight();
        return;
    }

    // Menü
    if (currentState === STATE_MENU) {
        // Simple Klick-Checks für die Buttons
        if (mouse.y >= 330 && mouse.y <= 365) {
            if (mouse.x >= 50 && mouse.x <= 130) { currentLevel = levels.easy; currentState = STATE_READY; }
            else if (mouse.x >= 160 && mouse.x <= 240) { currentLevel = levels.normal; currentState = STATE_READY; }
            else if (mouse.x >= 270 && mouse.x <= 350) { currentLevel = levels.hard; currentState = STATE_READY; }
        }
    }
    // Game Over -> Neustart
    else if (currentState === STATE_GAMEOVER && gameOverTimer > 180) {
        if (mouse.x >= restartBtn.x && mouse.x <= restartBtn.x + restartBtn.w &&
            mouse.y >= restartBtn.y && mouse.y <= restartBtn.y + restartBtn.h) {
            reset();
        }
    }
    // Bereit -> Start
    else if (currentState === STATE_READY) {
        currentState = STATE_PLAYING; bird.jump(); safePlay(bgMusic);
    }
    // Spielen -> Springen
    else if (currentState === STATE_PLAYING) {
        bird.jump();
    }
}

// Event Listener
canvas.addEventListener("touchstart", function(e) {
    e.preventDefault();
    let pos = getMousePos(canvas, e);
    
    // Steuerkreuz im Bosskampf
    if (currentState === STATE_BOSS_FIGHT || currentState === STATE_BOSS_INTRO) {
        if (Math.hypot(pos.x - (dPad.x + dPad.up.ox), pos.y - (dPad.y + dPad.up.oy)) < 25) moveUp = true;
        if (Math.hypot(pos.x - (dPad.x + dPad.down.ox), pos.y - (dPad.y + dPad.down.oy)) < 25) moveDown = true;
        if (Math.hypot(pos.x - (dPad.x + dPad.left.ox), pos.y - (dPad.y + dPad.left.oy)) < 25) moveLeft = true;
        if (Math.hypot(pos.x - (dPad.x + dPad.right.ox), pos.y - (dPad.y + dPad.right.oy)) < 25) moveRight = true;
    }
    handleTap(e);
}, {passive: false});

canvas.addEventListener("touchend", function(e) {
    e.preventDefault();
    moveUp = false; moveDown = false; moveLeft = false; moveRight = false;
});

canvas.addEventListener("mousedown", handleTap);

// Tastatur für PC
window.addEventListener("keydown", function(e) {
    if (e.code === "Space") {
        if (currentState === STATE_PLAYING) bird.jump();
        else if (currentState === STATE_READY) { currentState = STATE_PLAYING; bird.jump(); safePlay(bgMusic); }
        else if (currentState === STATE_BOSS_INTRO) { introTaps++; if(introTaps>=2) startBossFight(); }
    }
    if (currentState === STATE_BOSS_FIGHT) {
        if (e.code === "ArrowUp" || e.code === "KeyW") moveUp = true;
        if (e.code === "ArrowDown" || e.code === "KeyS") moveDown = true;
        if (e.code === "ArrowLeft" || e.code === "KeyA") moveLeft = true;
        if (e.code === "ArrowRight" || e.code === "KeyD") moveRight = true;
    }
});

window.addEventListener("keyup", function(e) {
    if (currentState === STATE_BOSS_FIGHT) {
        if (e.code === "ArrowUp" || e.code === "KeyW") moveUp = false;
        if (e.code === "ArrowDown" || e.code === "KeyS") moveDown = false;
        if (e.code === "ArrowLeft" || e.code === "KeyA") moveLeft = false;
        if (e.code === "ArrowRight" || e.code === "KeyD") moveRight = false;
    }
});

// Start Loop
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}
loop();
