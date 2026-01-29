// ==========================================
// 1. KONFIGURATION & PFADE
// ==========================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- RESPONSIVE LOGIK ---
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
window.addEventListener('resize', resizeGame);
resizeGame(); 

// --- BILDER ---
const characterImg = new Image();
characterImg.src = "assets/3DPingsta.webp"; 

const chainsawImg = new Image();
chainsawImg.src = "assets/chainsaw.webp"; 

const ak47Img = new Image();
ak47Img.src = "assets/AK47.webp";

const bgImg = new Image();
bgImg.src = "background.png"; 

// --- AUDIO ---
const fatalityAudio = new Audio("Fatality (Mortal Kombat) - QuickSounds.com.mp3");
const bgMusic = new Audio("NIEMAND.mp3");
bgMusic.loop = true;  
bgMusic.volume = 0.6; 

// NEU: Waffensound (Muss im Hauptordner liegen!)
const shotAudio = new Audio("shot.mp3");
shotAudio.volume = 0.3; // Nicht zu laut, damit Musik hörbar bleibt

// --- SPIELZUSTÄNDE ---
const STATE_MENU     = 0; 
const STATE_READY    = 1; 
const STATE_PLAYING  = 2; 
const STATE_GAMEOVER = 3; 

let currentState = STATE_MENU;
let frames = 0;
let score = 0;           
let coinsCollected = 0;  
let highScore = localStorage.getItem("pingstaHighscore") || 0;
let gameOverTimer = 0; 

// --- GAMEPLAY VARIABLEN ---
let pipesSpawnedCount = 0;   
let hasChainsaw = false;     
let hasAK47 = false;         
let invincibilityTimer = 0;  
let activeItem = null;       
let lostWeapon = null;       

// Schuss-System
let bullets = [];
let shootTimer = 0; 

const restartBtn = { x: canvas.width - 100, y: 10, w: 90, h: 40 };

const levels = {
    easy:   { gap: 260, speed: 1.8, color: "#00FF99" }, 
    normal: { gap: 210, speed: 2.5, color: "#FFaa00" }, 
    hard:   { gap: 160, speed: 3.2, color: "#FF0055" }  
};
let currentLevel = levels.normal;

// Listen
let explosionParticles = []; 
let screenDrips = [];  
let coinsCollection = []; 
let pipesPosition = []; 

// ==========================================
// 2. GRAFIK-FUNKTIONEN
// ==========================================

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
            bgMusic.pause(); bgMusic.currentTime = 0; 
            fatalityAudio.currentTime = 0; fatalityAudio.play().catch(e => console.log(e));
        }
        ctx.fillStyle = "#8a0303"; ctx.font = "60px 'Creepster', cursive"; ctx.fillText("FATALITY!", cx, cy);
    }
    else {
        ctx.font = "60px 'Creepster', cursive"; ctx.lineWidth = 4; ctx.strokeStyle = "black"; ctx.fillStyle = "#e3dac9"; 
        ctx.strokeText("GAME OVER", cx, cy - 30); ctx.fillText("GAME OVER", cx, cy - 30);
        ctx.font = "30px 'Creepster', cursive"; ctx.fillStyle = "white"; ctx.lineWidth = 1; ctx.fillText("Score: " + score, cx, cy + 20);
        ctx.fillStyle = "#FFD700"; ctx.font = "25px Arial"; ctx.fillText("Münzen: " + coinsCollected, cx, cy + 55);
        ctx.shadowBlur = 0; ctx.fillStyle = "#222"; ctx.fillRect(restartBtn.x, restartBtn.y, restartBtn.w, restartBtn.h);
        ctx.strokeStyle = "#FF0055"; ctx.lineWidth = 2; ctx.strokeRect(restartBtn.x, restartBtn.y, restartBtn.w, restartBtn.h);
        ctx.fillStyle = "#FFF"; ctx.font = "bold 16px Arial"; ctx.fillText("WEITER", restartBtn.x + restartBtn.w/2, restartBtn.y + 25);
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

function drawChainsawTurbine(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(frames * 0.15); 
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
    for(let i=0; i<4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = currentLevel.color; ctx.fillRect(-6, 12, 12, 60); 
        ctx.fillStyle = "#222";
        ctx.beginPath(); 
        for(let j=0; j<4; j++) { ctx.moveTo(-6, 15 + j*12); ctx.lineTo(-12, 20 + j*12); ctx.lineTo(-6, 25 + j*12); }
        for(let j=0; j<4; j++) { ctx.moveTo(6, 15 + j*12); ctx.lineTo(12, 20 + j*12); ctx.lineTo(6, 25 + j*12); }
        ctx.fill();
        ctx.fillStyle = "#a00"; ctx.fillRect(-2, 65, 4, 8); 
    }
    ctx.restore();
}

function drawCoin(x, y) {
    ctx.save();
    ctx.translate(x, y);
    let scaleX = Math.abs(Math.sin(frames * 0.05)); 
    ctx.scale(scaleX, 1); 
    ctx.fillStyle = "#FFDD00"; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 2; ctx.stroke(); 
    ctx.fillStyle = "#FFAA00"; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#FFF"; ctx.font = "bold 16px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("$", 0, 1);
    ctx.restore();
}

function drawButton(text, x, y, w, h, color) {
    ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "black"; ctx.font = "bold 14px Arial"; 
    ctx.textAlign = "center"; ctx.fillText(text, x + w/2, y + h/2 + 5);
}

// Items in der Luft
function drawItem(item) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(frames * 0.05); 
    let alpha = 0.5 + 0.5 * Math.abs(Math.sin(frames * 0.1)); 
    ctx.globalAlpha = alpha;
    
    let img = (item.type === "chainsaw") ? chainsawImg : ak47Img;
    
    if (img.complete && img.naturalHeight !== 0) {
        ctx.drawImage(img, -22, -22, 44, 44); 
    } else {
        ctx.fillStyle = "red"; ctx.fillRect(-20, -20, 40, 40);
        ctx.fillStyle = "white"; ctx.fillText(item.type, -15, 5);
    }
    ctx.restore();
}

// Wegfliegende Waffe
function drawLostWeapon() {
    if (!lostWeapon) return;
    ctx.save();
    ctx.translate(lostWeapon.x, lostWeapon.y);
    ctx.rotate(lostWeapon.rotation); 
    
    let img = (lostWeapon.type === "chainsaw") ? chainsawImg : ak47Img;

    if (img.complete && img.naturalHeight !== 0) {
        // Spiegeln damit es passt
        ctx.scale(-1, -1); 
        ctx.drawImage(img, -27, -17, 54, 34); 
    } else {
        ctx.fillStyle = "red"; ctx.fillRect(-25, -15, 50, 30);
    }
    ctx.restore();
}

// Kugeln
function drawBullets() {
    ctx.fillStyle = "#FFFF00"; 
    ctx.shadowColor = "#FFaa00"; ctx.shadowBlur = 10;
    
    for (let i = 0; i < bullets.length; i++) {
        let b = bullets[i];
        ctx.fillRect(b.x, b.y, 12, 4); 
    }
    ctx.shadowBlur = 0;
}

// ==========================================
// 3. SPIEL-OBJEKTE
// ==========================================

const bird = {
    x: 50, y: 200, w: 38, h: 48, velocity: 0, gravity: 0.25, jumpStrength: 4.6,
    
    draw: function() {
        if (currentState === STATE_GAMEOVER) return; 
        
        ctx.save();
        ctx.translate(this.x + this.w/2, this.y + this.h/2);
        
        if (invincibilityTimer > 0 && Math.floor(frames / 4) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        if (currentState === STATE_PLAYING) {
            ctx.rotate(Math.min(Math.PI/4, Math.max(-Math.PI/4, (this.velocity*0.1))));
        }
        
        // Pinguin spiegeln (schaut nach rechts)
        ctx.scale(-1, 1);

        if (characterImg.complete && characterImg.naturalHeight !== 0) {
            ctx.drawImage(characterImg, -this.w/2, -this.h/2, this.w, this.h);
        } else {
            ctx.fillStyle = "#111"; ctx.beginPath(); ctx.ellipse(0, 0, this.w/2, this.h/2, 0, 0, Math.PI*2); ctx.fill();
        }

        // WAFFEN ZEICHNEN
        if (hasChainsaw || hasAK47) {
            let bobbing = Math.sin(frames * 0.2) * 3;
            let img = hasChainsaw ? chainsawImg : ak47Img;

            if (img.complete && img.naturalHeight !== 0) {
                ctx.save();
                // Vertikal Flip (auf den Bauch drehen)
                ctx.scale(-1, -1); 
                
                if (hasAK47) {
                     // AK47 Position
                     ctx.drawImage(img, 5, -22 - bobbing, 60, 30);
                     
                     // MÜNDUNGSFEUER
                     if (frames % 8 < 3) {
                         ctx.fillStyle = "#FFFF00";
                         ctx.globalAlpha = 0.8;
                         ctx.beginPath();
                         ctx.arc(65, -8 - bobbing, 8 + Math.random()*5, 0, Math.PI*2);
                         ctx.fill();
                     }
                } else {
                    // Chainsaw Position
                    ctx.drawImage(img, 5, -25 - bobbing, 50, 30); 
                }
                
                ctx.restore();
            } else {
                ctx.fillStyle = "red"; ctx.fillRect(10, 10, 20, 10);
            }
        }

        ctx.restore();
    },
    
    update: function() {
        if (currentState !== STATE_PLAYING) {
            if (currentState !== STATE_GAMEOVER) this.y = 220 + Math.sin(frames * 0.1) * 8; 
            return;
        }
        this.velocity += this.gravity;
        this.y += this.velocity;
        
        if (this.y + this.h >= canvas.height) { 
            this.y = canvas.height - this.h; 
            gameOver(); 
        }

        if (invincibilityTimer > 0) invincibilityTimer--;
    },
    jump: function() { this.velocity = -this.jumpStrength; }
};

const background = {
    x: 0,
    draw: function() {
        if (bgImg.complete && bgImg.naturalHeight !== 0) {
            ctx.drawImage(bgImg, this.x, 0, canvas.width, canvas.height);
            ctx.drawImage(bgImg, this.x + canvas.width, 0, canvas.width, canvas.height);
        } else {
            let grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
            grad.addColorStop(0, "#2c003e"); 
            grad.addColorStop(0.5, "#880044"); 
            grad.addColorStop(1, "#000000");
            ctx.fillStyle = grad; ctx.fillRect(0,0, canvas.width, canvas.height);
        }
        if (currentState === STATE_GAMEOVER) {
            ctx.fillStyle = `rgba(150, 0, 20, ${Math.min(0.6, gameOverTimer * 0.005)})`;
            ctx.fillRect(0,0, canvas.width, canvas.height);
        }
    },
    update: function() { if (currentState === STATE_PLAYING) this.x = (this.x - 0.5) % canvas.width; }
};

// ==========================================
// 4. HAUPTSCHLEIFE
// ==========================================

function update() {
    bird.update();
    background.update();
    
    if (currentState === STATE_PLAYING) {
        updateGameObjects();
        updateBullets(); 
    }
    
    if (lostWeapon) {
        lostWeapon.x += lostWeapon.vx;
        lostWeapon.y += lostWeapon.vy;
        lostWeapon.vy += 0.5; 
        lostWeapon.rotation += 0.3; 
        if (lostWeapon.y > canvas.height + 50) lostWeapon = null;
    }

    frames++;
    if (currentState === STATE_GAMEOVER) gameOverTimer++;
}

function draw() {
    background.draw();
    
    for (let i = 0; i < pipesPosition.length; i++) {
        let p = pipesPosition[i];
        let bottomY = p.y + currentLevel.gap; 
        ctx.fillStyle = "#000"; ctx.fillRect(p.x, 0, 14, p.y);
        drawChainsawTurbine(p.x + 7, p.y); 
        ctx.fillStyle = "#000"; ctx.fillRect(p.x, bottomY, 14, canvas.height - bottomY);
        drawChainsawTurbine(p.x + 7, bottomY); 
    }
    
    for (let i = 0; i < coinsCollection.length; i++) {
        drawCoin(coinsCollection[i].x, coinsCollection[i].y);
    }

    if (activeItem) drawItem(activeItem);
    if (lostWeapon) drawLostWeapon();
    
    drawBullets(); 

    bird.draw();
    drawUI();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
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

function updateBullets() {
    // 1. Feuern (wenn AK47 vorhanden)
    if (hasAK47) {
        shootTimer++;
        if (shootTimer > 8) { // Feuerrate
            shootTimer = 0;
            
            // SOUND ABSPIELEN
            shotAudio.currentTime = 0; // Reset für schnelles Feuern
            shotAudio.play().catch(e => {});

            // Berechnung der exakten Mündungsposition
            let muzzleX = bird.x + bird.w + 40; 
            let muzzleY = bird.y + bird.h/2 + 8;

            bullets.push({
                x: muzzleX,
                y: muzzleY,
                vx: 12 
            });
        }
    }

    for (let i = 0; i < bullets.length; i++) {
        bullets[i].x += bullets[i].vx;
        if (bullets[i].x > canvas.width + 50) {
            bullets.splice(i, 1);
            i--;
        }
    }
}

function updateGameObjects() {
    // 1. SPAWNING
    if (frames % Math.floor(140 / (currentLevel.speed/2.5)) === 0) {
        let min = 50, max = canvas.height - currentLevel.gap - 50;
        let spawnY = Math.random() * (max - min) + min;
        
        pipesPosition.push({ x: canvas.width, y: spawnY, passed: false });
        pipesSpawnedCount++;

        // --- SPAWN LOGIK ---
        if (pipesSpawnedCount === 1 && !hasChainsaw && !hasAK47) {
             activeItem = { x: canvas.width + 25, y: spawnY + currentLevel.gap / 2, type: "chainsaw" };
        }
        else if (pipesSpawnedCount === 3) {
             activeItem = { x: canvas.width + 25, y: spawnY + currentLevel.gap / 2, type: "ak47" };
        }
        else if (pipesSpawnedCount > 3 && !activeItem && Math.random() > 0.6) {
             let type = (Math.random() > 0.5) ? "ak47" : "chainsaw";
             activeItem = { x: canvas.width + 25, y: spawnY + currentLevel.gap / 2, type: type };
        }
        else if (!activeItem && Math.random() > 0.4) {
             coinsCollection.push({ x: canvas.width + 25, y: spawnY + currentLevel.gap / 2 });
        }
    }

    // 2. KOLLISIONEN MIT RÖHREN
    for (let i = 0; i < pipesPosition.length; i++) {
        let p = pipesPosition[i];
        p.x -= currentLevel.speed;
        
        let safe = 8;
        if (bird.x+bird.w-safe > p.x-20 && bird.x+safe < p.x+14+20) {
            if (bird.y+safe < p.y+25 || bird.y+bird.h-safe > p.y+currentLevel.gap-25) {
                if (invincibilityTimer > 0) {
                    // Safe
                } else if (hasChainsaw || hasAK47) {
                    // Waffe verlieren
                    let wType = hasChainsaw ? "chainsaw" : "ak47";
                    hasChainsaw = false; 
                    hasAK47 = false;
                    invincibilityTimer = 60; 
                    triggerSmallBlood(bird.x + bird.w/2, bird.y + bird.h/2);
                    lostWeapon = {
                        x: bird.x + bird.w/2, y: bird.y + bird.h/2,
                        vx: 5, vy: -6, rotation: 0, type: wType
                    };
                } else {
                    gameOver();
                }
            }
        }
        if (p.x + 14 < bird.x && !p.passed) { score++; p.passed = true; }
        if (p.x < -100) { pipesPosition.shift(); i--; }
    }

    // MÜNZEN
    for (let i = 0; i < coinsCollection.length; i++) {
        let c = coinsCollection[i];
        c.x -= currentLevel.speed;
        let dist = Math.sqrt(((bird.x+bird.w/2) - c.x)**2 + ((bird.y+bird.h/2) - c.y)**2);
        if (dist < 35) { coinsCollected++; coinsCollection.splice(i, 1); i--; }
        else if (c.x < -50) { coinsCollection.splice(i, 1); i--; }
    }

    // ITEMS EINSAMMELN & WECHSELN
    if (activeItem) {
        activeItem.x -= currentLevel.speed;
        let dist = Math.sqrt(((bird.x+bird.w/2) - activeItem.x)**2 + ((bird.y+bird.h/2) - activeItem.y)**2);
        
        if (dist < 40) { 
            // Alte Waffe wegwerfen
            if (hasChainsaw || hasAK47) {
                let oldType = hasChainsaw ? "chainsaw" : "ak47";
                lostWeapon = {
                    x: bird.x + bird.w/2,
                    y: bird.y + bird.h/2,
                    vx: 5, vy: -6, rotation: 0, 
                    type: oldType
                };
                triggerSmallBlood(bird.x + bird.w/2, bird.y + bird.h/2);
            }

            hasChainsaw = false;
            hasAK47 = false;

            if (activeItem.type === "chainsaw") hasChainsaw = true;
            if (activeItem.type === "ak47") hasAK47 = true;
            
            activeItem = null; 
        } 
        else if (activeItem.x < -50) { activeItem = null; }
    }
}

function drawUI() {
    if (currentState === STATE_MENU) {
        drawBloodyTitle();
        ctx.fillStyle = "white"; ctx.font = "14px Arial"; ctx.textAlign = "center";
        ctx.fillText("Wähle deine Schwierigkeit:", canvas.width/2, 330);
        drawButton("EASY", 40, 350, 70, 30, levels.easy.color);
        drawButton("NORMAL", 125, 350, 70, 30, levels.normal.color);
        drawButton("HARD", 210, 350, 70, 30, levels.hard.color);
    } 
    else if (currentState === STATE_READY) {
        drawBloodyTitle();
        ctx.fillStyle = "#FFD700"; ctx.strokeStyle = "black"; ctx.lineWidth = 3; ctx.textAlign = "center";
        ctx.font = "30px Arial Black"; ctx.strokeText("BEREIT?", canvas.width/2, 350); ctx.fillText("BEREIT?", canvas.width/2, 350);
        ctx.fillStyle = "white"; ctx.font = "14px Arial"; ctx.fillText("(Klick zum Starten)", canvas.width/2, 380);
    } 
    else if (currentState === STATE_PLAYING) {
        ctx.fillStyle = "white"; ctx.strokeStyle = "black"; ctx.lineWidth = 3; ctx.textAlign = "left";
        ctx.font = "35px Arial Black"; ctx.strokeText(score, 15, 50); ctx.fillText(score, 15, 50);
        drawCoin(25, 80); 
        ctx.fillStyle = "#FFD700"; ctx.font = "bold 20px Arial"; ctx.fillText(coinsCollected, 45, 80); ctx.strokeText(coinsCollected, 45, 80);
    } 
    else if (currentState === STATE_GAMEOVER) {
        updateAndDrawBlood();
        drawFatalitySequence();
    }
}

// ==========================================
// 5. STEUERUNG
// ==========================================

function gameOver() {
    currentState = STATE_GAMEOVER;
    gameOverTimer = 0; 
    for (let i = 0; i < 60; i++) { 
        explosionParticles.push({
            x: bird.x + bird.w/2, y: bird.y + bird.h/2,
            vx: (Math.random() - 0.5) * 15, vy: (Math.random() - 0.5) * 15,
            size: Math.random() * 6 + 2, color: (Math.random() > 0.5) ? "#8a0303" : "#FF0000"
        });
    }
    for (let i = 0; i < 15; i++) {
        screenDrips.push({
            x: Math.random() * canvas.width, y: Math.random() * canvas.height/2, 
            w: Math.random() * 10 + 5, h: 0, speed: Math.random() * 2 + 1, maxH: Math.random() * 300 + 100 
        });
    }
    if (score > highScore) { highScore = score; localStorage.setItem("pingstaHighscore", highScore); }
}

function reset() {
    bird.y = 200; bird.velocity = 0;
    pipesPosition = []; coinsCollection = []; 
    explosionParticles = []; screenDrips = [];
    score = 0; coinsCollected = 0; frames = 0;
    
    // Reset Gameplay
    pipesSpawnedCount = 0; 
    hasChainsaw = false; 
    hasAK47 = false;
    activeItem = null; 
    lostWeapon = null; 
    invincibilityTimer = 0;
    bullets = []; 

    currentState = STATE_MENU; 
    bgMusic.pause(); bgMusic.currentTime = 0;
}

function getMousePos(canvas, evt) {
    let rect = canvas.getBoundingClientRect();
    let scaleX = canvas.width / rect.width;
    let scaleY = canvas.height / rect.height;
    return { 
        x: (evt.clientX - rect.left) * scaleX, 
        y: (evt.clientY - rect.top) * scaleY 
    };
}

function handleInput(e) {
    if (e.type === 'keydown' && e.code === "Space") {
        if (currentState === STATE_PLAYING) bird.jump();
        else if (currentState === STATE_READY) { currentState = STATE_PLAYING; bird.jump(); bgMusic.play().catch(e => console.log(e)); }
        return; 
    }
    if (e.type === 'click' || e.type === 'touchstart') {
        let mouse = getMousePos(canvas, e);
        if (currentState === STATE_MENU && e.type === 'click') {
            if (mouse.y >= 350 && mouse.y <= 380) {
                if (mouse.x >= 40 && mouse.x <= 110) { currentLevel = levels.easy; currentState = STATE_READY; }
                else if (mouse.x >= 125 && mouse.x <= 195) { currentLevel = levels.normal; currentState = STATE_READY; }
                else if (mouse.x >= 210 && mouse.x <= 280) { currentLevel = levels.hard; currentState = STATE_READY; }
            }
        }
        else if (currentState === STATE_GAMEOVER && gameOverTimer > 180) {
            if (mouse.x >= restartBtn.x && mouse.x <= restartBtn.x + restartBtn.w &&
                mouse.y >= restartBtn.y && mouse.y <= restartBtn.y + restartBtn.h) {
                reset();
            }
        }
        else if (currentState === STATE_READY) {
            currentState = STATE_PLAYING; bird.jump(); bgMusic.play().catch(e => console.log(e));
        }
        else if (currentState === STATE_PLAYING) {
            bird.jump();
        }
    }
}

window.addEventListener("keydown", handleInput);
canvas.addEventListener("click", handleInput);
canvas.addEventListener("touchstart", function(e) {
    if(currentState === STATE_PLAYING) { e.preventDefault(); handleInput(e); }
    else if(currentState === STATE_GAMEOVER && gameOverTimer > 180) { handleInput(e); }
}, {passive: false});

loop();
