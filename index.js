var parameters = new URLSearchParams(window.location.search)
var level = Number(parameters.get("level"))
var max_level = Number(localStorage.getItem("level"))

var levels_count = 10

if (!level || level < 1 || level > max_level) {
    window.location.href = "index.html"
}
var levelData

var finish

var suceeded = false

var canvas = document.querySelector("canvas")
canvas.width = innerWidth
canvas.height = innerHeight
var c = canvas.getContext("2d")

var camera = {x: canvas.width / 2, y: canvas.height / 2}

var clickPos = {x: 0, y: 0}

var started = false

var dragging = false

var drag = {
    pos: {x: undefined, y: undefined},
    pos0: {x: undefined, y: undefined}
}

function reflectVector(a, b) {
    var length = Math.hypot(b.x, b.y)
    var norm = {x: b.x / length, y: b.y / length}
    var dot = a.x * norm.x + a.y * norm.y

    return {x: a.x - 2 * dot * norm.x, y: a.y - 2 * dot * norm.y}
}

function getProjectionPoint(point, a, b) {
    var vect = {x: b.x - a.x, y: b.y - a.y}
    var lengthSqrd = vect.x * vect.x + vect.y * vect.y
    var point_vect = {x: point.pos.x - a.x, y: point.pos.y - a.y}

    var dot = vect.x * point_vect.x + vect.y * point_vect.y

    var t = dot / lengthSqrd

    t = Math.max(0, Math.min(t, 1))

    return {x: a.x + vect.x * t, y: a.y + vect.y * t}
}

class Player {
    constructor() {
        this.pos = {x: 0, y: 0}
        this.vel = {x: 0, y: 0}
        this.acc = {x: 0, y: 0}
        this.radius = 16
        this.damping = 0.995
        this.elasiticity = 0.8
    }
    draw() {
        c.beginPath()
        c.arc(this.pos.x, this.pos.y, this.radius - 1, 0, Math.PI * 2, false)
        c.fillStyle = "#f2c14e"
        c.strokeStyle = "#b8860b"
        c.lineWidth = 2
        c.fill()
        c.stroke()
    }
    collide() {
        magnets.forEach(magnet => {
            var vect = {x: this.pos.x - magnet.pos.x, y: this.pos.y - magnet.pos.y}
            var dist = Math.hypot(vect.x, vect.y)

            if (dist <= this.radius + magnet.radius) {
                var norm = {x: vect.x / dist, y: vect.y / dist}
                var x = this.radius + magnet.radius - dist
                this.pos.x += norm.x * x
                this.pos.y += norm.y * x
                var newVel = reflectVector(this.vel, norm)
                this.vel.x = newVel.x * this.elasiticity
                this.vel.y = newVel.y * this.elasiticity
            }
        })
        walls.forEach(wall => {
            var a = {x: wall.x1, y: wall.y1}
            var b = {x: wall.x2, y: wall.y2}
            var point = getProjectionPoint(this, a, b)
            var vect = {x: point.x - this.pos.x, y: point.y - this.pos.y}
            var dist = Math.hypot(vect.x, vect.y)
            if (dist < this.radius) {
                var x = this.radius - dist
                var norm = {x: vect.x / dist, y: vect.y / dist}
                this.pos.x -= norm.x * x
                this.pos.y -= norm.y * x
                var newVel = reflectVector(this.vel, norm)
                this.vel.x = newVel.x * this.elasiticity
                this.vel.y = newVel.y * this.elasiticity
            }
        })
    }
    update(dt) {
        this.vel.x += this.acc.x * dt
        this.vel.y += this.acc.y * dt
        this.acc = {x: 0, y: 0}
        this.vel.x *= this.damping
        this.vel.y *= this.damping
        this.pos.x += this.vel.x * dt
        this.pos.y += this.vel.y * dt

        if (!suceeded) {
            magnets.forEach(magnet => {
                var vect = {x: this.pos.x - magnet.pos.x, y: this.pos.y - magnet.pos.y}
                var dist = Math.hypot(vect.x, vect.y)
                if (dist == 0) {
                    return
                }
                var force = magnet.force / (dist * dist)
                var norm = {x: vect.x / dist, y: vect.y / dist}

                this.applyForce(-magnet.charge * norm.x * force, -magnet.charge * norm.y * force)
            })
        }
        else {
            var vect = {x: this.pos.x - finish.x, y: this.pos.y - finish.y}
            this.applyForce(-vect.x * 50, -vect.y * 50)
        }

        var toFinish = {x: this.pos.x - finish.x, y: this.pos.y - finish.y}
        var length = Math.hypot(toFinish.x, toFinish.y)

        if (length < finish.radius - this.radius) {
            finishLevel()
        }

        this.collide()
    }
    applyForce(x, y) {
        this.acc.x += x
        this.acc.y += y
    }
}

class Wall {
    constructor(x1, y1, x2, y2) {
        this.x1 = x1
        this.x2 = x2
        this.y1 = y1
        this.y2 = y2
    }
    draw() {
        c.beginPath()
        c.moveTo(this.x1, this.y1)
        c.lineTo(this.x2, this.y2)
        c.strokeStyle = "#241f1a"
        c.lineWidth = 2
        c.lineCap = "round"
        c.stroke()
    }
}

class Magnet {
    constructor(x, y, charge) {
        this.pos = {x: x, y: y}
        this.charge = charge
        this.radius = 32
        this.force = 2000000
    }
    draw() {
        c.beginPath()
        c.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2, false)
        if (this.charge == 1) {
            c.fillStyle = "#667a8a"
        }
        else {
            c.fillStyle = "#9a5c52"
        }
        c.fill()
    }
}

var player = new Player()
var walls = []
var magnets = []

async function loadLevel() {
    var levelResponse = await fetch(`Levels/Level${level}.json`)
    levelData = await levelResponse.json()
    levelData.walls.forEach(wall => {
        walls.push(new Wall(wall.x1, wall.y1, wall.x2, wall.y2))
    })
    finish = levelData.finish
}
loadLevel()

function finishLevel() {
    suceeded = true
    if (level == max_level) {
        localStorage.setItem("level", level + 1)
    }
    if (level == levels_count) {
        document.querySelector("#next-level").style.display = "none"
    }
    setTimeout(() => {
        document.querySelector("#level-passed").style.opacity = "1"
        document.querySelector("#level-passed").style.pointerEvents = "auto"
    }, 1000)
    
}
canvas.addEventListener("mousedown", (e) => {
    if (!started && e.button == 2) {
        dragging = true
        drag.pos0.x = e.clientX
        drag.pos0.y = e.clientY
        canvas.style.cursor = "grabbing"
    }
})
window.addEventListener("mousemove", (e) => {
    if (dragging) {
        drag.pos.x = e.clientX
        drag.pos.y = e.clientY
        camera.x += drag.pos.x - drag.pos0.x
        camera.y += drag.pos.y - drag.pos0.y
        drag.pos0.x = drag.pos.x
        drag.pos0.y = drag.pos.y
    }
})
window.addEventListener("mouseup", () => {
    dragging = false
    canvas.style.cursor = "auto"
})
canvas.addEventListener("mouseup", (e) => {
    if (e.button == 2 || dragging) {
        return
    }
    clickPos.x = e.clientX - camera.x
    clickPos.y = e.clientY - camera.y
    if (started || document.querySelector("#remove").checked) {
        magnets.forEach(magnet => {
            var vect = {x: magnet.pos.x - clickPos.x, y: magnet.pos.y - clickPos.y}
            var dist = Math.hypot(vect.x, vect.y)
            if (dist < magnet.radius) {
                magnets.splice(magnets.indexOf(magnet), 1)
            }
        })
        return
    }
    canAdd = true
    
    magnets.forEach(magnet => {
        var vect = {x: magnet.pos.x - clickPos.x, y: magnet.pos.y - clickPos.y}
        var dist = Math.hypot(vect.x, vect.y)
        if (dist < magnet.radius * 2) {
            canAdd = false
        }
    })
    walls.forEach(wall => {
        var a = {x: wall.x1, y: wall.y1}
        var b = {x: wall.x2, y: wall.y2}
        var point = getProjectionPoint({pos: {x: clickPos.x, y: clickPos.y}}, a, b)
        var dist = Math.hypot(clickPos.x - point.x, clickPos.y - point.y)
        if (dist < 32) {
            canAdd = false
        }
    })

    if (Math.hypot(clickPos.x - player.pos.x, clickPos.y - player.pos.y) < 32 + player.radius) {
        canAdd = false
    }
    if (Math.hypot(clickPos.x - finish.x, clickPos.y - finish.y) < 32 + finish.radius) {
        canAdd = false
    }

    var charge = 1
    if (canAdd) {
        if (document.querySelector("#repulsive").checked) {
            charge = -1
        }
        magnets.push(new Magnet(clickPos.x, clickPos.y, charge))
    }
})
window.addEventListener("contextmenu", (e) => {
    e.preventDefault()
})

document.querySelector("#start").addEventListener("click", () => {
    started = true
    document.querySelector("#tools").style.opacity = "0"
    document.querySelector("#tools").style.pointerEvents = "none"
})

function nextLevel() {
    window.location.href = `play.html?level=${level + 1}`
}

var t0 = 0
var targetdt = 1/60
var accumelator = 0

function animate(t) {
    requestAnimationFrame(animate)
    c.clearRect(0, 0, canvas.width, canvas.height)
    var dt = (t - t0) / 1000
    if (isNaN(dt) || dt > 0.1 || !started) {
        dt = 0
    }
    accumelator += dt
    t0 = t
    while (accumelator >= targetdt) {
        player.update(targetdt)
        accumelator -= targetdt
        camera.x = canvas.width / 2 - player.pos.x
        camera.y = canvas.height / 2 - player.pos.y
    }
    c.save()
    c.translate(camera.x, camera.y)
    walls.forEach(wall => {
        wall.draw()
    })
    magnets.forEach(magnet => {
        magnet.draw()
    })
    if (finish) {
        c.beginPath()
        c.arc(finish.x, finish.y, finish.radius - 2, 0, Math.PI * 2, false)
        c.strokeStyle = "#4ade80"
        c.lineWidth = 4
        c.stroke()
    }
    player.draw()
    c.restore()
}
animate()