// ==========================================
// 1. KONFIGURATION & ASSETS
// ==========================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// BILDER
const characterImg = new Image();
characterImg.src = "3DPingsta.png"; 

const bgImg = new Image();
bgImg.src = "background.png"; 

// AUDIO (NEU)
// Wir laden die Datei aus der Quelle [1]
const fatalityAudio = new Audio("Fatality (Mortal Kombat) - QuickSounds.com.mp3");

// SPIELZUSTÄNDE
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

// BUTTON (Oben Rechts)
const restartBtn = {
    x: canvas.width - 100,
    y: 10,
    w: 90,
    h: 40
};

// SCHWIERIGKEITSGRADE
const levels = {
    easy:   { gap: 250, speed: 1.8, color: "#4CAF50" },
    normal: { gap: 210, speed: 2.5, color: "#FF9800" }, 
    hard:   { gap: 160, speed: 3.2, color: "#F44336" }  
};
let currentLevel = levels.normal;

// SYSTEME
let explosionParticles = []; 
let screenDrips = [];  
let coinsCollection = []; 

// ==========================================
// 2. GRAFIK-FUNKTIONEN
// ==========================================

function drawBloodyTitle() {
    const centerX = canvas.width / 2;
    const topY = 60; 
    
    ctx.save();
    ctx.textAlign = "center";
    
    // Titel
    ctx.fillStyle = "black";
    ctx.font = "bold 40px Arial Black";
    ctx.fillText("PINGSTA'S", centerX + 2, topY + 2); 
    ctx.fillStyle = "#8a0303"; 
    ctx.fillText("PINGSTA'S", centerX, topY);

    // Blut-Deko
    ctx.fillRect(centerX - 100, topY + 5, 4, 15);
    ctx.fillRect(centerX + 80, topY + 5, 5, 25);

    // Rekord
    ctx.fillStyle = "#FFF";
    ctx.font = "bold 18px Arial";
    ctx.fillText("REKORD: " + highScore, centerX, topY + 35);
    ctx.restore();
}

function drawFatalitySequence() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    
    ctx.save();
    ctx.textAlign = "center";
    ctx.shadowColor = "black";
    ctx.shadowBlur = 10;

    // PHASE 1: "Ha Ha Haaaa!" (0 bis 1.5 Sekunden)
    if (gameOverTimer < 90) { 
        ctx.fillStyle = "#FF0000"; 
        ctx.font = "bold 45px 'Courier New'";
        let shakeX = (Math.random() - 0.5) * 10;
        let shakeY = (Math.random() - 0.5) * 10;
        ctx.fillText("Ha Ha Haaaa!", cx + shakeX, cy + shakeY);
    } 
    // PHASE 2: "FATALITY!" (1.5 bis 3 Sekunden)
    else if (gameOverTimer < 180) {
        // AUDIO TRIGGER: Genau beim Wechsel (Frame 90) abspielen
        if (gameOverTimer === 90) {
            fatalityAudio.currentTime = 0; // Zurückspulen falls nötig
            fatalityAudio.play().catch(e => console.log("Audio Error:", e));
        }

        ctx.fillStyle = "#8a0303"; 
        ctx.font = "60px 'Creepster', cursive"; // Knochen-Schrift
        ctx.fillText("FATALITY!", cx, cy);
    }
    // PHASE 3: "GAME OVER"
    else {
        ctx.font = "60px 'Creepster', cursive"; 
        ctx.lineWidth = 4;
        ctx.strokeStyle = "black";     
        ctx.fillStyle = "#e3dac9";     
        
        ctx.strokeText("GAME OVER", cx, cy - 30);
        ctx.fillText("GAME OVER", cx, cy - 30);
        
        // Stats darunter
        ctx.font = "30px 'Creepster', cursive";
        ctx.fillStyle = "white";
        ctx.lineWidth = 1;
        ctx.fillText("Score: " + score, cx, cy + 20);
        
        // Münzen im Game Over
        ctx.fillStyle = "#FFD700";
        ctx.font = "25px Arial";
        ctx.fillText("Münzen: " + coinsCollected, cx, cy + 55);

        // Weiter Button
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#222";
        ctx.fillRect(restartBtn.x, restartBtn.y, restartBtn.w, restartBtn.h);
        ctx.strokeStyle = "#a00"; 
        ctx.lineWidth = 2;
        ctx.strokeRect(restartBtn.x, restartBtn.y, restartBtn.w, restartBtn.h);
        
        ctx.fillStyle = "#FFF"; 
        ctx.font = "bold 16px Arial"; 
        ctx.fillText("WEITER", restartBtn.x + restartBtn.w/2, restartBtn.y + 25);
    }
    ctx.restore();
}

function triggerCarnage(x, y) {
    for (let i = 0; i < 60; i++) { 
        explosionParticles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 15, 
            vy: (Math.random() - 0.5) * 15,
            size: Math.random() * 6 + 2,
            color: (Math.random() > 0.5) ? "#8a0303" : "#ff0000"
        });
    }
    for (let i = 0; i < 15; i++) {
        screenDrips.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height/2, 
            w: Math.random() * 10 + 5, h: 0, 
            speed: Math.random() * 2 + 1, maxH: Math.random() * 300 + 100 
        });
    }
}

function updateAndDrawBlood() {
    for (let i = 0; i < explosionParticles.length; i++) {
        let p = explosionParticles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.size *= 0.95; 
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        if (p.size < 0.5) { explosionParticles.splice(i, 1); i--; }
    }
    ctx.fillStyle = "rgba(138, 3, 3, 0.8)"; 
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
        ctx.fillStyle = "#888"; ctx.fillRect(-6, 12, 12, 60); 
        ctx.fillStyle = "#333";
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
    ctx.fillStyle = "#FFD700"; 
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#DAA520"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#F0E68C"; 
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#B8860B";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", 0, 1);
    ctx.restore();
}

function drawUICoinIcon(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#FFD700"; 
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#DAA520"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#B8860B";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", 0, 1);
    ctx.restore();
}

function drawButton(text, x, y, w, h, color) {
    ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "white"; ctx.font = "bold 16px Arial";
    ctx.textAlign = "center"; ctx.fillText(text, x + w/2, y + h/2 + 5);
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
        if (currentState === STATE_PLAYING) ctx.rotate(Math.min(Math.PI/4, Math.max(-Math.PI/4, (this.velocity*0.1))));
        
        if (characterImg.complete && characterImg.naturalHeight !== 0) {
            ctx.drawImage(characterImg, -this.w/2, -this.h/2, this.w, this.h);
        } else {
            ctx.fillStyle = "#111"; ctx.beginPath(); ctx.ellipse(0, 0, this.w/2, this.h/2, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#FFF"; ctx.beginPath(); ctx.ellipse(0, 5, this.w/3, this.h/3, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#FFD700"; ctx.beginPath(); ctx.moveTo(5, -5); ctx.lineTo(18, 0); ctx.lineTo(5, 5); ctx.fill();
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
        if (this.y + this.h >= canvas.height) { this.y = canvas.height - this.h; gameOver(); }
    },
    jump: function() { this.velocity = -this.jumpStrength; }
};

const coins = {
    update: function() {
        if (currentState !== STATE_PLAYING) return;
        for (let i = 0; i < coinsCollection.length; i++) {
            let c = coinsCollection[i];
            c.x -= currentLevel.speed;
            let birdCX = bird.x + bird.w/2;
            let birdCY = bird.y + bird.h/2;
            let dx = birdCX - c.x;
            let dy = birdCY - c.y;
            let distance = Math.sqrt(dx*dx + dy*dy);
            if (distance < 35) {
                coinsCollected++; 
                coinsCollection.splice(i, 1); 
                i--;
                continue;
            }
            if (c.x < -50) {
                coinsCollection.splice(i, 1);
                i--;
            }
        }
    },
    draw: function() {
        for (let i = 0; i < coinsCollection.length; i++) {
            drawCoin(coinsCollection[i].x, coinsCollection[i].y);
        }
    }
};

const pipes = {
    position: [], w: 14,
    draw: function() {
        for (let i = 0; i < this.position.length; i++) {
            let p = this.position[i];
            let bottomY = p.y + currentLevel.gap; 
            ctx.fillStyle = "#000"; ctx.fillRect(p.x, 0, this.w, p.y);
            drawChainsawTurbine(p.x + this.w/2, p.y);
            ctx.fillStyle = "#000"; ctx.fillRect(p.x, bottomY, this.w, canvas.height - bottomY);
            drawChainsawTurbine(p.x + this.w/2, bottomY);
        }
    },
    update: function() {
        if (currentState !== STATE_PLAYING) return;
        if (frames % Math.floor(140 / (currentLevel.speed/2.5)) === 0) {
            let min = 50, max = canvas.height - currentLevel.gap - 50;
            let spawnY = Math.random() * (max - min) + min;
            this.position.push({ x: canvas.width, y: spawnY });
            if (Math.random() > 0.4) {
                coinsCollection.push({
                    x: canvas.width + 25, 
                    y: spawnY + currentLevel.gap / 2 
                });
            }
        }
        for (let i = 0; i < this.position.length; i++) {
            let p = this.position[i];
            p.x -= currentLevel.speed;
            let safe = 8;
            if (bird.x+bird.w-safe > p.x-20 && bird.x+safe < p.x+this.w+20) {
                if (bird.y+safe < p.y+25 || bird.y+bird.h-safe > p.y+currentLevel.gap-25) gameOver();
            }
            if (p.x + this.w < bird.x && !p.passed) { score++; p.passed = true; }
            if (p.x + this.w <= -100) { this.position.shift(); i--; }
        }
    }
};

const background = {
    x: 0,
    draw: function() {
        if (bgImg.complete && bgImg.naturalHeight !== 0) {
            ctx.drawImage(bgImg, this.x, 0, canvas.width, canvas.height);
            ctx.drawImage(bgImg, this.x + canvas.width, 0, canvas.width, canvas.height);
        } else {
            let grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
            grad.addColorStop(0, "#4a0e4e"); grad.addColorStop(0.5, "#d93030"); grad.addColorStop(1, "#000000");
            ctx.fillStyle = grad; ctx.fillRect(0,0, canvas.width, canvas.height);
        }
        if (currentState === STATE_GAMEOVER) {
            ctx.fillStyle = `rgba(100, 0, 0, ${Math.min(0.6, gameOverTimer * 0.005)})`;
            ctx.fillRect(0,0, canvas.width, canvas.height);
        }
    },
    update: function() { if (currentState === STATE_PLAYING) this.x = (this.x - 0.5) % canvas.width; }
};

// ==========================================
// 4. GAME LOOP
// ==========================================

function draw() {
    background.draw();
    pipes.draw();
    coins.draw(); 
    bird.draw();
    
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
        
        drawUICoinIcon(25, 80); 
        ctx.fillStyle = "#FFD700"; ctx.lineWidth = 1; ctx.strokeStyle = "black";
        ctx.font = "bold 20px Arial";
        ctx.fillText(coinsCollected, 45, 80); 
        ctx.strokeText(coinsCollected, 45, 80);
    } 
    else if (currentState === STATE_GAMEOVER) {
        updateAndDrawBlood();
        drawFatalitySequence();
    }
}

function update() {
    bird.update();
    background.update();
    pipes.update();
    coins.update();
    frames++;
    if (currentState === STATE_GAMEOVER) gameOverTimer++;
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

function gameOver() {
    currentState = STATE_GAMEOVER;
    gameOverTimer = 0; 
    triggerCarnage(bird.x + bird.w/2, bird.y + bird.h/2);

    if (score > highScore) {
        highScore = score;
        localStorage.setItem("pingstaHighscore", highScore);
    }
}

function reset() {
    bird.y = 200;
    bird.velocity = 0;
    pipes.position = [];
    coinsCollection = []; 
    explosionParticles = [];
    screenDrips = [];
    score = 0;
    coinsCollected = 0; 
    frames = 0;
    currentState = STATE_MENU; 
}

// ==========================================
// 5. INPUT HANDLING
// ==========================================

function getMousePos(canvas, evt) {
    let rect = canvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}

function handleInput(e) {
    if (e.type === 'keydown' && e.code === "Space") {
        if (currentState === STATE_PLAYING) bird.jump();
        else if (currentState === STATE_READY) { currentState = STATE_PLAYING; bird.jump(); }
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
            currentState = STATE_PLAYING;
            bird.jump();
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

// START
loop();