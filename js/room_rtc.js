const APP_ID = "dce1009b5f434c2c94dc9b84a7753347"//connecting to agora sdk project
let uid = sessionStorage.getItem('uid')
if(!uid){//creating random user id if user id doesn't exist
    uid = String(Math.floor(Math.random() * 10000))
    sessionStorage.setItem('uid', uid)
}
let token = null;//authentication of user 
let client;//store info about user

let rtmClient;
let channel;
const queryString = window.location.search
const urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room')//creating a room id for custom rooms

if(!roomId){
    roomId = 'main'
}

let displayName = sessionStorage.getItem('display_name')
if(!displayName){//to redirect user to the lobby page
    window.location = 'lobby.html'
}

let localTracks = []
let remoteUsers = {}

let localScreenTracks;
let sharingScreen = false;

let joinRoomInit = async () => {
    rtmClient = await AgoraRTM.createInstance(APP_ID)// starts agora client 
    await rtmClient.login({uid,token})//assign user their id and token

    await rtmClient.addOrUpdateLocalUserAttributes({'name':displayName})//assign user the name inputed by user in the lobby

    channel = await rtmClient.createChannel(roomId)
    await channel.join()

    channel.on('MemberJoined', handleMemberJoined)
    channel.on('MemberLeft', handleMemberLeft)
    channel.on('ChannelMessage', handleChannelMessage)

    getMembers()
    addBotMessageToDom(`Welcome to the room ${displayName}! 👋`)

    client = AgoraRTC.createClient({mode:'rtc', codec:'vp8'})
    await client.join(APP_ID, roomId, token, uid)

    client.on('user-published', handleUserPublished)
    client.on('user-left', handleUserLeft)
}

let joinStream = async () => {

    document.getElementById('join-btn').style.display = 'none'// Hide the "Join" button 
    document.getElementsByClassName('stream__actions')[0].style.display = 'flex'//displaystream action

    localTracks = await AgoraRTC.createMicrophoneAndCameraTracks({}, {encoderConfig:{
        width:{min:640, ideal:1920, max:1920},
        height:{min:480, ideal:1080, max:1080}
    }})


    let player = `<div class="video__container" id="user-container-${uid}">
                    <div class="video-player" id="user-${uid}"></div>
                 </div>`

    document.getElementById('streams__container').insertAdjacentHTML('beforeend', player)
    document.getElementById(`user-container-${uid}`).addEventListener('click', expandVideoFrame)

    localTracks[1].play(`user-${uid}`)
    await client.publish([localTracks[0], localTracks[1]])
}

let switchToCamera = async () => {
    //create a new video element which is specific to user id
    let player = `<div class="video__container" id="user-container-${uid}">  
                    <div class="video-player" id="user-${uid}"></div>
                 </div>`
    displayFrame.insertAdjacentHTML('beforeend', player)

    await localTracks[0].setMuted(true)
    await localTracks[1].setMuted(true)

    document.getElementById('mic-btn').classList.remove('active')
    document.getElementById('screen-btn').classList.remove('active')

    localTracks[1].play(`user-${uid}`)
    await client.publish([localTracks[1]])
}

let handleUserPublished = async (user, mediaType) => {
    remoteUsers[user.uid] = user

    await client.subscribe(user, mediaType)

    let player = document.getElementById(`user-container-${user.uid}`)
    if(player === null){//creates new video player element for new user
        player = `<div class="video__container" id="user-container-${user.uid}">
                <div class="video-player" id="user-${user.uid}"></div>
            </div>`
        document.getElementById('streams__container').insertAdjacentHTML('beforeend', player)
        document.getElementById(`user-container-${user.uid}`).addEventListener('click', expandVideoFrame)
    }
    if(displayFrame.style.display){
        let videoFrame = document.getElementById(`user-container-${user.uid}`)//decrease size of other video if someone is pinned
        videoFrame.style.height = '100px'
        videoFrame.style.width = '100px'
    }

    if(mediaType === 'video'){
        user.videoTrack.play(`user-${user.uid}`)
    }

    if(mediaType === 'audio'){
        user.audioTrack.play()
    }
}
let handleUserLeft = async (user) => {//if the user left it deletes the user id from agora
    delete remoteUsers[user.uid]
    let item = document.getElementById(`user-container-${user.uid}`)
    if(item){
        item.remove()
    }

    if(userIdInDisplayFrame === `user-container-${user.uid}`){
        displayFrame.style.display = null
        
        let videoFrames = document.getElementsByClassName('video__container')

        for(let i = 0; videoFrames.length > i; i++){//if user left was pinned or sharing screen out video tiles are resized
            videoFrames[i].style.height = '300px'
            videoFrames[i].style.width = '300px'
        }
    }
}

let toggleMic = async (e) => {
    let button = e.currentTarget

    if(localTracks[0].muted){
        await localTracks[0].setMuted(false)//if mic muted then it unmutes
        button.classList.add('active')
    }else{
        await localTracks[0].setMuted(true)//if mic unmuted then it mutes
        button.classList.remove('active')
    }
}
let toggleCamera = async (e) => {
    let button = e.currentTarget

    if(localTracks[1].muted){
        await localTracks[1].setMuted(false)// if camera off it turn it on
        button.classList.add('active')
    }else{
        await localTracks[1].setMuted(true)//if camera off it turn it on
        button.classList.remove('active')
    }
}
let toggleScreen = async (e) => {//screen sharing
    let screenButton = e.currentTarget
    let cameraButton = document.getElementById('camera-btn')
    if(!sharingScreen){//turns screen sharing on
        sharingScreen = true
        screenButton.classList.add('active')
        cameraButton.classList.remove('active')
        cameraButton.style.display = 'none'
        localScreenTracks = await AgoraRTC.createScreenVideoTrack()
        document.getElementById(`user-container-${uid}`).remove()
        displayFrame.style.display = 'block'
        let player = `<div class="video__container" id="user-container-${uid}">
                <div class="video-player" id="user-${uid}"></div>
            </div>`
        displayFrame.insertAdjacentHTML('beforeend', player)
        document.getElementById(`user-container-${uid}`).addEventListener('click', expandVideoFrame)
        userIdInDisplayFrame = `user-container-${uid}`//creates custom user id for screen sharing
        localScreenTracks.play(`user-${uid}`)
        await client.unpublish([localTracks[1]])
        await client.publish([localScreenTracks])
        let videoFrames = document.getElementsByClassName('video__container')//resizes video title when screen shared
        for(let i = 0; videoFrames.length > i; i++){
            if(videoFrames[i].id != userIdInDisplayFrame){
              videoFrames[i].style.height = '100px'
              videoFrames[i].style.width = '100px'
            }
          }
    }else{
        sharingScreen = false 
        cameraButton.style.display = 'block'
        document.getElementById(`user-container-${uid}`).remove()//removes user screen screenshare id 
        await client.unpublish([localScreenTracks])
        switchToCamera()
    }
}
let leaveStream = async (e) => {
    e.preventDefault()
    document.getElementById('join-btn').style.display = 'block'//display join stream button again
    document.getElementsByClassName('stream__actions')[0].style.display = 'none'//hide stream controls
    for(let i = 0; localTracks.length > i; i++){
        localTracks[i].stop()
        localTracks[i].close()//stop sharing video and turn off microphone
    }
    await client.unpublish([localTracks[0], localTracks[1]])
    if(localScreenTracks){
        await client.unpublish([localScreenTracks])}
    document.getElementById(`user-container-${uid}`).remove()
    if(userIdInDisplayFrame === `user-container-${uid}`){// if pinned user left then video sizes are resized
        displayFrame.style.display = null
        for(let i = 0; videoFrames.length > i; i++){
            videoFrames[i].style.height = '300px'
            videoFrames[i].style.width = '300px'}}
channel.sendMessage({text:JSON.stringify({'type':'user_left', 'uid':uid})})}
document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('mic-btn').addEventListener('click', toggleMic)
document.getElementById('screen-btn').addEventListener('click', toggleScreen)
document.getElementById('join-btn').addEventListener('click', joinStream)
document.getElementById('leave-btn').addEventListener('click', leaveStream)
joinRoomInit()