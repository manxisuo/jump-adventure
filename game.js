// 跳跃冒险 - Jump Adventure
// A complete 2D platformer game with touch support

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const TILE_SIZE = 32;
const GRAVITY = 0.6;
const MAX_FALL_SPEED = 15;
const COYOTE_TIME = 6;
const JUMP_BUFFER_TIME = 8;

// Difficulty settings
const DIFFICULTY = {
    easy: {
        name: '简单',
        lives: 5,
        platformSpeed: 0.8,
        hazardSpeed: 0.6,
        jumpHeight: 13,
        description: '更多生命，更慢的机关'
    },
    normal: {
        name: '普通',
        lives: 3,
        platformSpeed: 1.0,
        hazardSpeed: 1.0,
        jumpHeight: 12,
        description: '标准难度'
    },
    hard: {
        name: '困难',
        lives: 1,
        platformSpeed: 1.3,
        hazardSpeed: 1.5,
        jumpHeight: 11,
        description: '一命通关挑战'
    }
};

// Game state
let gameState = 'menu'; // menu, playing, paused, levelComplete, gameOver
let currentDifficulty = 'normal';
let currentLevel = 0;
let player = null;
let camera = { x: 0, y: 0 };
let coins = [];
let platforms = [];
let movingPlatforms = [];
let hazards = [];
let checkpoints = [];
let goalFlag = null;
let lastCheckpoint = null;
let collectedCoins = 0;
let totalCoins = 0;
let deaths = 0;
let startTime = 0;
let elapsedTime = 0;
let pausedTime = 0;
let pauseStartTime = 0;
let lives = 3;

// Input handling
const keys = {};
let jumpBufferCounter = 0;

// Touch support
let isTouchDevice = false;
let touchControls = {
    left: false,
    right: false,
    jump: false,
    jumpHeld: false
};
let activeTouches = {};

// Canvas scaling
let scale = 1;
let dpr = 1;
const BASE_WIDTH = 800;
const BASE_HEIGHT = 600;

// Touch control elements
const touchControlsEl = document.getElementById('touchControls');
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const btnJump = document.getElementById('btnJump');
const btnPause = document.getElementById('btnPause');
const landscapeHint = document.getElementById('landscapeHint');

// Detect touch device
function detectTouchDevice() {
    isTouchDevice = ('ontouchstart' in window) || 
                    (navigator.maxTouchPoints > 0) || 
                    (navigator.msMaxTouchPoints > 0);
    
    if (isTouchDevice) {
        touchControlsEl.classList.add('visible');
    } else {
        touchControlsEl.classList.remove('visible');
    }
    
    updatePauseButtonVisibility();
}

function updatePauseButtonVisibility() {
    if (isTouchDevice && (gameState === 'playing' || gameState === 'paused')) {
        btnPause.classList.add('visible');
    } else {
        btnPause.classList.remove('visible');
    }
}

function checkOrientation() {
    if (!isTouchDevice) {
        landscapeHint.classList.remove('visible');
        return;
    }
    
    const isPortrait = window.innerHeight > window.innerWidth;
    const isTooSmall = window.innerWidth < 500;
    
    if (isPortrait && isTooSmall && gameState === 'menu') {
        landscapeHint.classList.add('visible');
    } else {
        landscapeHint.classList.remove('visible');
    }
}

function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const scaleX = windowWidth / BASE_WIDTH;
    const scaleY = windowHeight / BASE_HEIGHT;
    scale = Math.min(scaleX, scaleY);
    
    canvas.width = BASE_WIDTH * dpr;
    canvas.height = BASE_HEIGHT * dpr;
    canvas.style.width = `${BASE_WIDTH * scale}px`;
    canvas.style.height = `${BASE_HEIGHT * scale}px`;
    
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    checkOrientation();
    detectTouchDevice();
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => {
    setTimeout(resizeCanvas, 100);
});
resizeCanvas();

// Prevent default touch behaviors on the entire document
document.addEventListener('touchstart', (e) => {
    if (e.target.closest('#gameContainer')) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    if (e.target.closest('#gameContainer')) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchend', (e) => {
    if (e.target.closest('#gameContainer')) {
        e.preventDefault();
    }
}, { passive: false });

// Prevent context menu
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Hide landscape hint on tap
landscapeHint.addEventListener('click', () => {
    landscapeHint.classList.remove('visible');
});
landscapeHint.addEventListener('touchstart', (e) => {
    e.preventDefault();
    landscapeHint.classList.remove('visible');
}, { passive: false });

// Touch control handlers
function handleTouchStart(e) {
    e.preventDefault();
    
    for (const touch of e.changedTouches) {
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        
        if (target === btnLeft) {
            activeTouches[touch.identifier] = 'left';
            touchControls.left = true;
            btnLeft.classList.add('active');
        } else if (target === btnRight) {
            activeTouches[touch.identifier] = 'right';
            touchControls.right = true;
            btnRight.classList.add('active');
        } else if (target === btnJump) {
            activeTouches[touch.identifier] = 'jump';
            touchControls.jump = true;
            touchControls.jumpHeld = true;
            btnJump.classList.add('active');
            jumpBufferCounter = JUMP_BUFFER_TIME;
        } else if (target === btnPause) {
            activeTouches[touch.identifier] = 'pause';
            togglePause();
        }
    }
}

function handleTouchMove(e) {
    e.preventDefault();
    
    for (const touch of e.changedTouches) {
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const currentBtn = activeTouches[touch.identifier];
        
        if (currentBtn === 'left' && target !== btnLeft) {
            touchControls.left = false;
            btnLeft.classList.remove('active');
            if (target === btnRight) {
                activeTouches[touch.identifier] = 'right';
                touchControls.right = true;
                btnRight.classList.add('active');
            } else {
                delete activeTouches[touch.identifier];
            }
        } else if (currentBtn === 'right' && target !== btnRight) {
            touchControls.right = false;
            btnRight.classList.remove('active');
            if (target === btnLeft) {
                activeTouches[touch.identifier] = 'left';
                touchControls.left = true;
                btnLeft.classList.add('active');
            } else {
                delete activeTouches[touch.identifier];
            }
        } else if (currentBtn === 'jump' && target !== btnJump) {
            touchControls.jump = false;
            touchControls.jumpHeld = false;
            btnJump.classList.remove('active');
            delete activeTouches[touch.identifier];
        }
    }
}

function handleTouchEnd(e) {
    e.preventDefault();
    
    for (const touch of e.changedTouches) {
        const btn = activeTouches[touch.identifier];
        
        if (btn === 'left') {
            touchControls.left = false;
            btnLeft.classList.remove('active');
        } else if (btn === 'right') {
            touchControls.right = false;
            btnRight.classList.remove('active');
        } else if (btn === 'jump') {
            touchControls.jump = false;
            touchControls.jumpHeld = false;
            btnJump.classList.remove('active');
        }
        
        delete activeTouches[touch.identifier];
    }
}

btnLeft.addEventListener('touchstart', handleTouchStart, { passive: false });
btnRight.addEventListener('touchstart', handleTouchStart, { passive: false });
btnJump.addEventListener('touchstart', handleTouchStart, { passive: false });
btnPause.addEventListener('touchstart', handleTouchStart, { passive: false });

document.addEventListener('touchmove', handleTouchMove, { passive: false });
document.addEventListener('touchend', handleTouchEnd, { passive: false });
document.addEventListener('touchcancel', handleTouchEnd, { passive: false });

// Canvas touch handler for menus and UI
function getCanvasTouchPos(touch) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (touch.clientX - rect.left) / scale,
        y: (touch.clientY - rect.top) / scale
    };
}

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    
    if (e.touches.length === 0) return;
    const pos = getCanvasTouchPos(e.touches[0]);
    
    handleCanvasTap(pos.x, pos.y);
}, { passive: false });

canvas.addEventListener('click', (e) => {
    if (isTouchDevice) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    
    handleCanvasTap(x, y);
});

function handleCanvasTap(x, y) {
    if (gameState === 'menu') {
        const diffs = Object.keys(DIFFICULTY);
        for (let i = 0; i < diffs.length; i++) {
            const btnY = 280 + i * 60;
            if (x >= BASE_WIDTH / 2 - 120 && x <= BASE_WIDTH / 2 + 120 &&
                y >= btnY - 25 && y <= btnY + 25) {
                currentDifficulty = diffs[i];
                return;
            }
        }
        
        if (y >= 450 && y <= 600) {
            startGame();
        }
    } else if (gameState === 'paused') {
        if (x >= BASE_WIDTH / 2 - 100 && x <= BASE_WIDTH / 2 + 100) {
            if (y >= 280 && y <= 330) {
                togglePause();
            } else if (y >= 350 && y <= 400) {
                restartLevel();
            } else if (y >= 420 && y <= 470) {
                gameState = 'menu';
                updatePauseButtonVisibility();
            }
        }
    } else if (gameState === 'gameOver') {
        if (y >= 380 && y <= 460) {
            restartLevel();
        }
    } else if (gameState === 'levelComplete') {
        if (y >= 440 && y <= 520) {
            nextLevel();
        } else if (y >= 500 && y <= 560) {
            restartLevel();
        }
    }
}

// Keyboard input events
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Escape', 'KeyP'].includes(e.code)) {
        e.preventDefault();
    }
    
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        jumpBufferCounter = JUMP_BUFFER_TIME;
    }
    
    if (gameState === 'menu') {
        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
            const diffs = Object.keys(DIFFICULTY);
            const idx = diffs.indexOf(currentDifficulty);
            currentDifficulty = diffs[(idx - 1 + diffs.length) % diffs.length];
        }
        if (e.code === 'ArrowDown' || e.code === 'KeyS') {
            const diffs = Object.keys(DIFFICULTY);
            const idx = diffs.indexOf(currentDifficulty);
            currentDifficulty = diffs[(idx + 1) % diffs.length];
        }
        if (e.code === 'Enter' || e.code === 'Space') {
            startGame();
        }
    }
    
    if (gameState === 'playing') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
            togglePause();
        }
    }
    
    if (gameState === 'paused') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
            togglePause();
        }
    }
    
    if (gameState === 'gameOver') {
        if (e.code === 'KeyR') {
            restartLevel();
        }
    }
    
    if (gameState === 'levelComplete') {
        if (e.code === 'Enter' || e.code === 'Space') {
            nextLevel();
        }
        if (e.code === 'KeyR') {
            restartLevel();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Player class
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 24;
        this.height = 32;
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.coyoteCounter = 0;
        this.jumpsRemaining = 2;
        this.facingRight = true;
        this.wasOnGround = false;
        this.spawnX = x;
        this.spawnY = y;
        this.onMovingPlatform = null;
        this.jumpHeld = false;
        this.jumpReleased = true;
    }
    
    update() {
        const diff = DIFFICULTY[currentDifficulty];
        const moveSpeed = 0.5;
        const maxSpeed = 5;
        const friction = 0.85;
        const airControl = 0.3;
        
        // Horizontal movement (keyboard + touch)
        let moveInput = 0;
        if (keys['ArrowLeft'] || keys['KeyA'] || touchControls.left) moveInput -= 1;
        if (keys['ArrowRight'] || keys['KeyD'] || touchControls.right) moveInput += 1;
        
        if (moveInput !== 0) {
            this.facingRight = moveInput > 0;
            const accel = this.onGround ? moveSpeed : moveSpeed * airControl;
            this.vx += moveInput * accel;
        }
        
        // Apply friction
        if (this.onGround) {
            this.vx *= friction;
        } else {
            this.vx *= 0.98;
        }
        
        // Clamp horizontal speed
        this.vx = Math.max(-maxSpeed, Math.min(maxSpeed, this.vx));
        
        // Coyote time
        if (this.onGround) {
            this.coyoteCounter = COYOTE_TIME;
            this.jumpsRemaining = 2;
        } else {
            this.coyoteCounter--;
        }
        
        // Jump input check (keyboard + touch)
        const jumpPressed = keys['Space'] || keys['ArrowUp'] || keys['KeyW'] || touchControls.jumpHeld;
        
        // Jump (with variable height)
        if (jumpBufferCounter > 0 && this.jumpReleased) {
            if (this.coyoteCounter > 0) {
                // Normal jump
                this.vy = -diff.jumpHeight;
                this.coyoteCounter = 0;
                this.jumpsRemaining = 1;
                jumpBufferCounter = 0;
                this.jumpHeld = true;
                this.jumpReleased = false;
                this.onMovingPlatform = null;
            } else if (this.jumpsRemaining > 0) {
                // Double jump
                this.vy = -diff.jumpHeight * 0.9;
                this.jumpsRemaining = 0;
                jumpBufferCounter = 0;
                this.jumpHeld = true;
                this.jumpReleased = false;
            }
        }
        
        // Variable jump height - cut jump short when releasing
        if (!jumpPressed) {
            this.jumpReleased = true;
            if (this.vy < -3 && this.jumpHeld) {
                this.vy *= 0.5;
                this.jumpHeld = false;
            }
        }
        
        if (jumpBufferCounter > 0) jumpBufferCounter--;
        
        // Gravity
        this.vy += GRAVITY;
        this.vy = Math.min(this.vy, MAX_FALL_SPEED);
        
        // Store previous ground state
        this.wasOnGround = this.onGround;
        this.onGround = false;
        this.onMovingPlatform = null;
        
        // Move and collide
        this.moveX();
        this.moveY();
        
        // Check hazards
        this.checkHazards();
        
        // Check coins
        this.checkCoins();
        
        // Check checkpoints
        this.checkCheckpoints();
        
        // Check goal
        this.checkGoal();
        
        // Fall death
        if (this.y > getLevelHeight() + 100) {
            this.die();
        }
    }
    
    moveX() {
        this.x += this.vx;
        
        // Moving platform horizontal carry
        if (this.onMovingPlatform) {
            this.x += this.onMovingPlatform.vx;
        }
        
        // Collide with static platforms
        for (const plat of platforms) {
            if (this.collidesWith(plat)) {
                if (this.vx > 0) {
                    this.x = plat.x - this.width;
                } else if (this.vx < 0) {
                    this.x = plat.x + plat.width;
                }
                this.vx = 0;
            }
        }
        
        // Collide with moving platforms (sides)
        for (const plat of movingPlatforms) {
            if (this.collidesWith(plat)) {
                if (this.vx > 0) {
                    this.x = plat.x - this.width;
                } else if (this.vx < 0) {
                    this.x = plat.x + plat.width;
                }
                this.vx = 0;
            }
        }
    }
    
    moveY() {
        this.y += this.vy;
        
        // Collide with static platforms
        for (const plat of platforms) {
            if (this.collidesWith(plat)) {
                if (this.vy > 0) {
                    this.y = plat.y - this.height;
                    this.vy = 0;
                    this.onGround = true;
                } else if (this.vy < 0) {
                    this.y = plat.y + plat.height;
                    this.vy = 0;
                }
            }
        }
        
        // Collide with moving platforms
        for (const plat of movingPlatforms) {
            if (this.collidesWith(plat)) {
                if (this.vy > 0) {
                    this.y = plat.y - this.height;
                    this.vy = 0;
                    this.onGround = true;
                    this.onMovingPlatform = plat;
                } else if (this.vy < 0) {
                    this.y = plat.y + plat.height;
                    this.vy = 0;
                }
            }
        }
    }
    
    collidesWith(rect) {
        return this.x < rect.x + rect.width &&
               this.x + this.width > rect.x &&
               this.y < rect.y + rect.height &&
               this.y + this.height > rect.y;
    }
    
    checkHazards() {
        for (const hazard of hazards) {
            if (this.collidesWith(hazard.getBounds())) {
                this.die();
                return;
            }
        }
    }
    
    checkCoins() {
        for (let i = coins.length - 1; i >= 0; i--) {
            const coin = coins[i];
            if (!coin.collected && this.collidesWith(coin)) {
                coin.collected = true;
                collectedCoins++;
            }
        }
    }
    
    checkCheckpoints() {
        for (const cp of checkpoints) {
            if (this.collidesWith(cp) && !cp.activated) {
                cp.activated = true;
                lastCheckpoint = cp;
                this.spawnX = cp.x + cp.width / 2 - this.width / 2;
                this.spawnY = cp.y + cp.height - this.height;
            }
        }
    }
    
    checkGoal() {
        if (goalFlag && this.collidesWith(goalFlag)) {
            levelComplete();
        }
    }
    
    die() {
        deaths++;
        lives--;
        
        if (lives <= 0) {
            gameState = 'gameOver';
            updatePauseButtonVisibility();
        } else {
            this.respawn();
        }
    }
    
    respawn() {
        this.x = this.spawnX;
        this.y = this.spawnY;
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.jumpsRemaining = 2;
    }
    
    draw() {
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        
        // Body
        ctx.fillStyle = '#4ecdc4';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Eyes
        ctx.fillStyle = '#fff';
        const eyeOffset = this.facingRight ? 4 : -4;
        ctx.fillRect(this.x + this.width/2 - 6 + eyeOffset, this.y + 8, 5, 6);
        ctx.fillRect(this.x + this.width/2 + 1 + eyeOffset, this.y + 8, 5, 6);
        
        // Pupils
        ctx.fillStyle = '#1a1a2e';
        const pupilOffset = this.facingRight ? 2 : -2;
        ctx.fillRect(this.x + this.width/2 - 4 + eyeOffset + pupilOffset, this.y + 10, 2, 3);
        ctx.fillRect(this.x + this.width/2 + 3 + eyeOffset + pupilOffset, this.y + 10, 2, 3);
        
        ctx.restore();
    }
}

// Moving Platform class
class MovingPlatform {
    constructor(x, y, width, height, moveX, moveY, speed) {
        this.startX = x;
        this.startY = y;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.moveX = moveX; // Total horizontal movement
        this.moveY = moveY; // Total vertical movement
        this.speed = speed;
        this.progress = 0;
        this.direction = 1;
        this.vx = 0;
        this.vy = 0;
    }
    
    update() {
        const diff = DIFFICULTY[currentDifficulty];
        const prevX = this.x;
        const prevY = this.y;
        
        this.progress += this.speed * diff.platformSpeed * this.direction * 0.01;
        
        if (this.progress >= 1 || this.progress <= 0) {
            this.direction *= -1;
            this.progress = Math.max(0, Math.min(1, this.progress));
        }
        
        this.x = this.startX + this.moveX * this.progress;
        this.y = this.startY + this.moveY * this.progress;
        
        this.vx = this.x - prevX;
        this.vy = this.y - prevY;
    }
    
    draw() {
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        
        ctx.fillStyle = '#8b5cf6';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Platform details
        ctx.fillStyle = '#a78bfa';
        ctx.fillRect(this.x + 4, this.y + 4, this.width - 8, 4);
        
        ctx.restore();
    }
}

// Hazard classes
class Spike {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width || TILE_SIZE;
        this.height = height || TILE_SIZE;
    }
    
    getBounds() {
        return {
            x: this.x + 4,
            y: this.y + 8,
            width: this.width - 8,
            height: this.height - 8
        };
    }
    
    update() {}
    
    draw() {
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        
        ctx.fillStyle = '#ef4444';
        const spikeCount = Math.floor(this.width / 16);
        for (let i = 0; i < spikeCount; i++) {
            ctx.beginPath();
            ctx.moveTo(this.x + i * 16, this.y + this.height);
            ctx.lineTo(this.x + i * 16 + 8, this.y);
            ctx.lineTo(this.x + i * 16 + 16, this.y + this.height);
            ctx.closePath();
            ctx.fill();
        }
        
        ctx.restore();
    }
}

class MovingEnemy {
    constructor(x, y, rangeX, speed) {
        this.startX = x;
        this.x = x;
        this.y = y;
        this.width = 28;
        this.height = 28;
        this.rangeX = rangeX;
        this.speed = speed;
        this.direction = 1;
    }
    
    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
    
    update() {
        const diff = DIFFICULTY[currentDifficulty];
        this.x += this.speed * diff.hazardSpeed * this.direction;
        
        if (this.x > this.startX + this.rangeX || this.x < this.startX) {
            this.direction *= -1;
        }
    }
    
    draw() {
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        
        // Body
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x + this.width/2 - 5, this.y + this.height/2 - 4, 4, 0, Math.PI * 2);
        ctx.arc(this.x + this.width/2 + 5, this.y + this.height/2 - 4, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Angry eyebrows
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x + this.width/2 - 8, this.y + this.height/2 - 8);
        ctx.lineTo(this.x + this.width/2 - 2, this.y + this.height/2 - 5);
        ctx.moveTo(this.x + this.width/2 + 8, this.y + this.height/2 - 8);
        ctx.lineTo(this.x + this.width/2 + 2, this.y + this.height/2 - 5);
        ctx.stroke();
        
        ctx.restore();
    }
}

class Lava {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.animOffset = Math.random() * Math.PI * 2;
    }
    
    getBounds() {
        return {
            x: this.x,
            y: this.y + 8,
            width: this.width,
            height: this.height - 8
        };
    }
    
    update() {}
    
    draw() {
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        
        // Lava body
        ctx.fillStyle = '#f97316';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Animated bubbles
        ctx.fillStyle = '#fbbf24';
        const time = Date.now() / 200;
        for (let i = 0; i < this.width / 20; i++) {
            const bubbleX = this.x + 10 + i * 20;
            const bubbleY = this.y + 8 + Math.sin(time + i + this.animOffset) * 4;
            ctx.beginPath();
            ctx.arc(bubbleX, bubbleY, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}

// Coin class
class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.collected = false;
        this.animOffset = Math.random() * Math.PI * 2;
    }
    
    draw() {
        if (this.collected) return;
        
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        
        const time = Date.now() / 200;
        const bobY = Math.sin(time + this.animOffset) * 3;
        
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(this.x + this.width/2, this.y + this.height/2 + bobY, 10, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(this.x + this.width/2 + 2, this.y + this.height/2 + bobY, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

// Checkpoint class
class Checkpoint {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 24;
        this.height = 48;
        this.activated = false;
    }
    
    draw() {
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        
        // Pole
        ctx.fillStyle = '#6b7280';
        ctx.fillRect(this.x + 10, this.y, 4, this.height);
        
        // Flag
        ctx.fillStyle = this.activated ? '#22c55e' : '#9ca3af';
        ctx.beginPath();
        ctx.moveTo(this.x + 14, this.y);
        ctx.lineTo(this.x + 14 + 20, this.y + 12);
        ctx.lineTo(this.x + 14, this.y + 24);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }
}

// Goal flag class
class GoalFlag {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 32;
        this.height = 64;
    }
    
    draw() {
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        
        // Pole
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(this.x + 12, this.y, 6, this.height);
        
        // Flag
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(this.x + 18, this.y);
        ctx.lineTo(this.x + 18 + 30, this.y + 15);
        ctx.lineTo(this.x + 18, this.y + 30);
        ctx.closePath();
        ctx.fill();
        
        // Star
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        const starX = this.x + 30;
        const starY = this.y + 15;
        for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI / 5) - Math.PI / 2;
            const r = i % 2 === 0 ? 6 : 3;
            const px = starX + Math.cos(angle) * r;
            const py = starY + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }
}

// Level definitions
const levels = [
    // Level 1 - Tutorial level
    {
        playerStart: { x: 64, y: 400 },
        platforms: [
            // Ground
            { x: 0, y: 500, width: 400, height: 100 },
            { x: 500, y: 500, width: 300, height: 100 },
            { x: 900, y: 500, width: 200, height: 100 },
            { x: 1200, y: 500, width: 400, height: 100 },
            { x: 1700, y: 500, width: 200, height: 100 },
            { x: 2000, y: 500, width: 600, height: 100 },
            
            // Floating platforms
            { x: 150, y: 400, width: 100, height: 20 },
            { x: 320, y: 330, width: 80, height: 20 },
            { x: 600, y: 400, width: 100, height: 20 },
            { x: 750, y: 320, width: 100, height: 20 },
            
            // Section 2 platforms
            { x: 1000, y: 400, width: 80, height: 20 },
            { x: 1100, y: 340, width: 80, height: 20 },
            
            // High section
            { x: 1350, y: 350, width: 150, height: 20 },
            { x: 1550, y: 280, width: 100, height: 20 },
            
            // Final section
            { x: 2100, y: 380, width: 120, height: 20 },
            { x: 2300, y: 300, width: 150, height: 20 },
        ],
        movingPlatforms: [
            { x: 400, y: 420, width: 80, height: 20, moveX: 0, moveY: -100, speed: 1 },
            { x: 850, y: 400, width: 80, height: 20, moveX: 100, moveY: 0, speed: 1.2 },
            { x: 1900, y: 450, width: 80, height: 20, moveX: 80, moveY: 0, speed: 1 },
        ],
        coins: [
            { x: 180, y: 370 }, { x: 350, y: 300 }, { x: 630, y: 370 },
            { x: 780, y: 290 }, { x: 900, y: 470 }, { x: 1030, y: 370 },
            { x: 1130, y: 310 }, { x: 1400, y: 320 }, { x: 1580, y: 250 },
            { x: 1750, y: 470 }, { x: 2050, y: 470 }, { x: 2150, y: 350 },
            { x: 2350, y: 270 }, { x: 2400, y: 270 }, { x: 2500, y: 470 },
        ],
        hazards: [
            { type: 'spike', x: 450, y: 468, width: 48, height: 32 },
            { type: 'spike', x: 800, y: 468, width: 32, height: 32 },
            { type: 'lava', x: 1100, y: 530, width: 100, height: 70 },
            { type: 'enemy', x: 1400, y: 470, rangeX: 150, speed: 1.5 },
            { type: 'spike', x: 2200, y: 468, width: 64, height: 32 },
        ],
        checkpoints: [
            { x: 700, y: 452 },
            { x: 1400, y: 452 },
            { x: 2100, y: 452 },
        ],
        goal: { x: 2520, y: 436 },
        width: 2700,
        height: 600
    },
    // Level 2 - More challenging
    {
        playerStart: { x: 64, y: 450 },
        platforms: [
            // Start area
            { x: 0, y: 520, width: 200, height: 80 },
            { x: 100, y: 420, width: 80, height: 20 },
            { x: 220, y: 350, width: 80, height: 20 },
            
            // Gap section
            { x: 350, y: 450, width: 100, height: 20 },
            { x: 500, y: 380, width: 80, height: 20 },
            { x: 620, y: 320, width: 80, height: 20 },
            
            // Moving platform section
            { x: 800, y: 500, width: 150, height: 100 },
            { x: 1100, y: 500, width: 150, height: 100 },
            
            // Vertical challenge
            { x: 1350, y: 550, width: 100, height: 50 },
            { x: 1350, y: 400, width: 100, height: 20 },
            { x: 1350, y: 250, width: 100, height: 20 },
            
            // Final stretch
            { x: 1550, y: 200, width: 120, height: 20 },
            { x: 1750, y: 300, width: 100, height: 20 },
            { x: 1900, y: 400, width: 100, height: 20 },
            { x: 2050, y: 500, width: 250, height: 100 },
            
            // High platforms
            { x: 2200, y: 350, width: 80, height: 20 },
            { x: 2350, y: 280, width: 80, height: 20 },
            { x: 2500, y: 350, width: 200, height: 20 },
        ],
        movingPlatforms: [
            { x: 300, y: 520, width: 60, height: 20, moveX: 0, moveY: -150, speed: 1.2 },
            { x: 700, y: 300, width: 80, height: 20, moveX: 100, moveY: 0, speed: 1 },
            { x: 950, y: 450, width: 80, height: 20, moveX: 100, moveY: 0, speed: 1.5 },
            { x: 1250, y: 400, width: 70, height: 20, moveX: 0, moveY: 150, speed: 0.8 },
            { x: 1480, y: 350, width: 60, height: 20, moveX: 0, moveY: -120, speed: 1 },
        ],
        coins: [
            { x: 130, y: 390 }, { x: 250, y: 320 }, { x: 380, y: 420 },
            { x: 530, y: 350 }, { x: 650, y: 290 }, { x: 850, y: 470 },
            { x: 1000, y: 380 }, { x: 1150, y: 470 }, { x: 1380, y: 520 },
            { x: 1380, y: 370 }, { x: 1380, y: 220 }, { x: 1580, y: 170 },
            { x: 1780, y: 270 }, { x: 1930, y: 370 }, { x: 2100, y: 470 },
            { x: 2230, y: 320 }, { x: 2380, y: 250 }, { x: 2550, y: 320 },
            { x: 2600, y: 320 }, { x: 2650, y: 320 },
        ],
        hazards: [
            { type: 'lava', x: 200, y: 560, width: 150, height: 40 },
            { type: 'spike', x: 450, y: 418, width: 48, height: 32 },
            { type: 'enemy', x: 800, y: 470, rangeX: 100, speed: 2 },
            { type: 'spike', x: 1100, y: 468, width: 32, height: 32 },
            { type: 'lava', x: 1450, y: 560, width: 100, height: 40 },
            { type: 'enemy', x: 1750, y: 272, rangeX: 80, speed: 1.5 },
            { type: 'spike', x: 2000, y: 468, width: 48, height: 32 },
            { type: 'enemy', x: 2050, y: 470, rangeX: 180, speed: 2 },
        ],
        checkpoints: [
            { x: 800, y: 452 },
            { x: 1380, y: 202 },
            { x: 2080, y: 452 },
        ],
        goal: { x: 2620, y: 286 },
        width: 2800,
        height: 600
    }
];

function getLevelWidth() {
    return levels[currentLevel].width;
}

function getLevelHeight() {
    return levels[currentLevel].height;
}

function loadLevel(levelIndex) {
    const level = levels[levelIndex];
    
    // Reset state
    player = new Player(level.playerStart.x, level.playerStart.y);
    camera = { x: 0, y: 0 };
    
    // Load platforms
    platforms = level.platforms.map(p => ({
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height
    }));
    
    // Load moving platforms
    movingPlatforms = level.movingPlatforms.map(p => 
        new MovingPlatform(p.x, p.y, p.width, p.height, p.moveX, p.moveY, p.speed)
    );
    
    // Load coins
    coins = level.coins.map(c => new Coin(c.x, c.y));
    totalCoins = coins.length;
    collectedCoins = 0;
    
    // Load hazards
    hazards = level.hazards.map(h => {
        switch (h.type) {
            case 'spike': return new Spike(h.x, h.y, h.width, h.height);
            case 'lava': return new Lava(h.x, h.y, h.width, h.height);
            case 'enemy': return new MovingEnemy(h.x, h.y, h.rangeX, h.speed);
        }
    });
    
    // Load checkpoints
    checkpoints = level.checkpoints.map(c => new Checkpoint(c.x, c.y));
    lastCheckpoint = null;
    
    // Load goal
    goalFlag = new GoalFlag(level.goal.x, level.goal.y);
}

function startGame() {
    gameState = 'playing';
    currentLevel = 0;
    lives = DIFFICULTY[currentDifficulty].lives;
    deaths = 0;
    startTime = Date.now();
    pausedTime = 0;
    loadLevel(currentLevel);
    updatePauseButtonVisibility();
}

function restartLevel() {
    gameState = 'playing';
    lives = DIFFICULTY[currentDifficulty].lives;
    deaths = 0;
    startTime = Date.now();
    pausedTime = 0;
    loadLevel(currentLevel);
    updatePauseButtonVisibility();
}

function togglePause() {
    if (gameState === 'playing') {
        gameState = 'paused';
        pauseStartTime = Date.now();
    } else if (gameState === 'paused') {
        gameState = 'playing';
        pausedTime += Date.now() - pauseStartTime;
    }
    updatePauseButtonVisibility();
}

function levelComplete() {
    gameState = 'levelComplete';
    elapsedTime = Date.now() - startTime - pausedTime;
    updatePauseButtonVisibility();
}

function nextLevel() {
    currentLevel++;
    if (currentLevel >= levels.length) {
        currentLevel = 0;
    }
    lives = DIFFICULTY[currentDifficulty].lives;
    deaths = 0;
    startTime = Date.now();
    pausedTime = 0;
    loadLevel(currentLevel);
    gameState = 'playing';
    updatePauseButtonVisibility();
}

function updateCamera() {
    const targetX = player.x - BASE_WIDTH / 2 + player.width / 2;
    const targetY = player.y - BASE_HEIGHT / 2 + player.height / 2;
    
    camera.x += (targetX - camera.x) * 0.1;
    camera.y += (targetY - camera.y) * 0.1;
    
    // Clamp camera
    camera.x = Math.max(0, Math.min(camera.x, getLevelWidth() - BASE_WIDTH));
    camera.y = Math.max(0, Math.min(camera.y, getLevelHeight() - BASE_HEIGHT));
}

function drawBackground() {
    // Sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, BASE_HEIGHT);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    
    // Stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let i = 0; i < 50; i++) {
        const x = (i * 137 + camera.x * 0.1) % BASE_WIDTH;
        const y = (i * 89) % (BASE_HEIGHT * 0.6);
        ctx.fillRect(x, y, 2, 2);
    }
    
    // Far mountains
    ctx.fillStyle = '#0f3460';
    ctx.beginPath();
    ctx.moveTo(0, BASE_HEIGHT);
    for (let x = 0; x <= BASE_WIDTH; x += 100) {
        const h = 150 + Math.sin((x + camera.x * 0.2) * 0.01) * 50;
        ctx.lineTo(x, BASE_HEIGHT - h);
    }
    ctx.lineTo(BASE_WIDTH, BASE_HEIGHT);
    ctx.closePath();
    ctx.fill();
}

function drawPlatforms() {
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    
    for (const plat of platforms) {
        // Main platform
        ctx.fillStyle = '#374151';
        ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
        
        // Top grass
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(plat.x, plat.y, plat.width, 8);
        
        // Texture
        ctx.fillStyle = '#4b5563';
        for (let x = plat.x + 8; x < plat.x + plat.width - 8; x += 24) {
            for (let y = plat.y + 16; y < plat.y + plat.height - 8; y += 16) {
                ctx.fillRect(x, y, 8, 4);
            }
        }
    }
    
    ctx.restore();
}

function drawUI() {
    // Coin counter
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(40, 35, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(42, 35, 7, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Microsoft YaHei, SimHei, sans-serif';
    ctx.fillText(`${collectedCoins} / ${totalCoins}`, 60, 42);
    
    // Lives
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 20px Microsoft YaHei, SimHei, sans-serif';
    ctx.fillText(`生命: ${lives}`, BASE_WIDTH - 100, 35);
    
    // Level indicator
    ctx.fillStyle = '#9ca3af';
    ctx.font = '16px Microsoft YaHei, SimHei, sans-serif';
    ctx.fillText(`第 ${currentLevel + 1} 关`, BASE_WIDTH / 2 - 25, 30);
    
    // Time
    const time = Math.floor((Date.now() - startTime - pausedTime) / 1000);
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    ctx.fillText(`${minutes}:${seconds.toString().padStart(2, '0')}`, BASE_WIDTH / 2 - 20, 52);
}

function drawMenu() {
    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    
    // Stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let i = 0; i < 100; i++) {
        const x = (i * 137 + Date.now() * 0.01) % BASE_WIDTH;
        const y = (i * 89) % BASE_HEIGHT;
        ctx.fillRect(x, y, 2, 2);
    }
    
    // Title
    ctx.fillStyle = '#4ecdc4';
    ctx.font = 'bold 56px Microsoft YaHei, SimHei, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('跳跃冒险', BASE_WIDTH / 2, 120);
    
    ctx.fillStyle = '#9ca3af';
    ctx.font = '20px Microsoft YaHei, SimHei, sans-serif';
    ctx.fillText('Jump Adventure', BASE_WIDTH / 2, 155);
    
    // Difficulty selection
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Microsoft YaHei, SimHei, sans-serif';
    ctx.fillText('选择难度', BASE_WIDTH / 2, 220);
    
    const diffs = Object.keys(DIFFICULTY);
    diffs.forEach((diff, i) => {
        const y = 280 + i * 60;
        const isSelected = currentDifficulty === diff;
        
        if (isSelected) {
            ctx.fillStyle = '#4ecdc4';
            ctx.fillRect(BASE_WIDTH / 2 - 120, y - 25, 240, 50);
        }
        
        ctx.fillStyle = isSelected ? '#1a1a2e' : '#9ca3af';
        ctx.font = 'bold 22px Microsoft YaHei, SimHei, sans-serif';
        ctx.fillText(DIFFICULTY[diff].name, BASE_WIDTH / 2, y);
        
        ctx.font = '14px Microsoft YaHei, SimHei, sans-serif';
        ctx.fillText(DIFFICULTY[diff].description, BASE_WIDTH / 2, y + 20);
    });
    
    // Controls hint
    ctx.fillStyle = '#6b7280';
    ctx.font = '16px Microsoft YaHei, SimHei, sans-serif';
    if (isTouchDevice) {
        ctx.fillText('点击难度选择  |  点击下方开始游戏', BASE_WIDTH / 2, 480);
    } else {
        ctx.fillText('↑↓ 选择难度  |  Enter/空格 开始游戏', BASE_WIDTH / 2, 480);
    }
    
    ctx.fillStyle = '#9ca3af';
    ctx.font = '18px Microsoft YaHei, SimHei, sans-serif';
    ctx.fillText('游戏操作', BASE_WIDTH / 2, 520);
    ctx.font = '14px Microsoft YaHei, SimHei, sans-serif';
    if (isTouchDevice) {
        ctx.fillText('◀▶ 移动  |  ⬆ 跳跃（可二段跳，长按跳更高）', BASE_WIDTH / 2, 545);
    } else {
        ctx.fillText('← → 或 A D 移动  |  ↑ W 空格 跳跃（可二段跳）', BASE_WIDTH / 2, 545);
    }
    ctx.fillText('收集金币，避开危险，到达终点旗帜！', BASE_WIDTH / 2, 570);
    
    ctx.textAlign = 'left';
}

function drawPaused() {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    
    ctx.textAlign = 'center';
    
    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px Microsoft YaHei, SimHei, sans-serif';
    ctx.fillText('暂停', BASE_WIDTH / 2, 200);
    
    // Buttons
    const buttons = [
        { text: '继续游戏', y: 300 },
        { text: '重新开始', y: 370 },
        { text: '返回菜单', y: 440 }
    ];
    
    buttons.forEach(btn => {
        ctx.fillStyle = 'rgba(78, 205, 196, 0.3)';
        ctx.fillRect(BASE_WIDTH / 2 - 100, btn.y - 25, 200, 50);
        ctx.strokeStyle = '#4ecdc4';
        ctx.lineWidth = 2;
        ctx.strokeRect(BASE_WIDTH / 2 - 100, btn.y - 25, 200, 50);
        
        ctx.fillStyle = '#fff';
        ctx.font = '22px Microsoft YaHei, SimHei, sans-serif';
        ctx.fillText(btn.text, BASE_WIDTH / 2, btn.y + 8);
    });
    
    if (!isTouchDevice) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '16px Microsoft YaHei, SimHei, sans-serif';
        ctx.fillText('按 P 或 Esc 继续', BASE_WIDTH / 2, 520);
    }
    
    ctx.textAlign = 'left';
}

function drawLevelComplete() {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    
    ctx.textAlign = 'center';
    
    // Title
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 48px Microsoft YaHei, SimHei, sans-serif';
    ctx.fillText('关卡完成！', BASE_WIDTH / 2, 120);
    
    // Stats
    ctx.fillStyle = '#fff';
    ctx.font = '24px Microsoft YaHei, SimHei, sans-serif';
    
    const minutes = Math.floor(elapsedTime / 60000);
    const seconds = Math.floor((elapsedTime % 60000) / 1000);
    
    ctx.fillText(`收集金币: ${collectedCoins} / ${totalCoins}`, BASE_WIDTH / 2, 200);
    ctx.fillText(`用时: ${minutes}:${seconds.toString().padStart(2, '0')}`, BASE_WIDTH / 2, 250);
    ctx.fillText(`死亡次数: ${deaths}`, BASE_WIDTH / 2, 300);
    
    // Rating
    let rating = '⭐';
    if (collectedCoins === totalCoins && deaths === 0) rating = '⭐⭐⭐';
    else if (collectedCoins >= totalCoins * 0.7 && deaths <= 2) rating = '⭐⭐';
    
    ctx.font = '36px Microsoft YaHei, SimHei, sans-serif';
    ctx.fillText(rating, BASE_WIDTH / 2, 370);
    
    // Buttons
    ctx.fillStyle = 'rgba(78, 205, 196, 0.3)';
    ctx.fillRect(BASE_WIDTH / 2 - 100, 430, 200, 50);
    ctx.strokeStyle = '#4ecdc4';
    ctx.lineWidth = 2;
    ctx.strokeRect(BASE_WIDTH / 2 - 100, 430, 200, 50);
    
    ctx.fillStyle = '#fff';
    ctx.font = '22px Microsoft YaHei, SimHei, sans-serif';
    ctx.fillText('下一关', BASE_WIDTH / 2, 463);
    
    ctx.fillStyle = 'rgba(156, 163, 175, 0.3)';
    ctx.fillRect(BASE_WIDTH / 2 - 80, 500, 160, 40);
    ctx.strokeStyle = '#9ca3af';
    ctx.strokeRect(BASE_WIDTH / 2 - 80, 500, 160, 40);
    
    ctx.fillStyle = '#9ca3af';
    ctx.font = '18px Microsoft YaHei, SimHei, sans-serif';
    ctx.fillText('重玩本关', BASE_WIDTH / 2, 527);
    
    if (!isTouchDevice) {
        ctx.fillStyle = '#6b7280';
        ctx.font = '14px Microsoft YaHei, SimHei, sans-serif';
        ctx.fillText('Enter/空格 下一关  |  R 重玩', BASE_WIDTH / 2, 570);
    }
    
    ctx.textAlign = 'left';
}

function drawGameOver() {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    
    ctx.textAlign = 'center';
    
    // Title
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 48px Microsoft YaHei, SimHei, sans-serif';
    ctx.fillText('游戏结束', BASE_WIDTH / 2, 180);
    
    // Stats
    ctx.fillStyle = '#fff';
    ctx.font = '24px Microsoft YaHei, SimHei, sans-serif';
    ctx.fillText(`收集金币: ${collectedCoins} / ${totalCoins}`, BASE_WIDTH / 2, 260);
    ctx.fillText(`死亡次数: ${deaths}`, BASE_WIDTH / 2, 310);
    
    // Restart button
    ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.fillRect(BASE_WIDTH / 2 - 100, 380, 200, 50);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(BASE_WIDTH / 2 - 100, 380, 200, 50);
    
    ctx.fillStyle = '#fff';
    ctx.font = '22px Microsoft YaHei, SimHei, sans-serif';
    ctx.fillText('重新开始', BASE_WIDTH / 2, 413);
    
    if (!isTouchDevice) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '16px Microsoft YaHei, SimHei, sans-serif';
        ctx.fillText('按 R 重新开始', BASE_WIDTH / 2, 480);
    }
    
    ctx.textAlign = 'left';
}

function update() {
    if (gameState === 'playing') {
        player.update();
        updateCamera();
        
        for (const plat of movingPlatforms) {
            plat.update();
        }
        
        for (const hazard of hazards) {
            hazard.update();
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    
    if (gameState === 'menu') {
        drawMenu();
    } else if (gameState === 'playing' || gameState === 'paused' || gameState === 'levelComplete' || gameState === 'gameOver') {
        drawBackground();
        drawPlatforms();
        
        for (const plat of movingPlatforms) {
            plat.draw();
        }
        
        for (const coin of coins) {
            coin.draw();
        }
        
        for (const cp of checkpoints) {
            cp.draw();
        }
        
        goalFlag.draw();
        
        for (const hazard of hazards) {
            hazard.draw();
        }
        
        player.draw();
        drawUI();
        
        if (gameState === 'paused') {
            drawPaused();
        } else if (gameState === 'levelComplete') {
            drawLevelComplete();
        } else if (gameState === 'gameOver') {
            drawGameOver();
        }
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Initialize and start
detectTouchDevice();
gameLoop();
