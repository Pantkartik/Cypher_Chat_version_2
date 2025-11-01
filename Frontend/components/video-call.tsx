"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { 
  Phone, 
  PhoneOff, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Users,
  X,
  Maximize2,
  Minimize2,
  Settings
} from "lucide-react"

interface VideoCallProps {
  isOpen: boolean
  onClose: () => void
  sessionId: string
  username: string
  socket: any
  targetUserId?: string
  isGroupCall?: boolean
  isAudioOnly?: boolean
}

interface CallParticipant {
  id: string
  name: string
  stream?: MediaStream
  isVideoEnabled: boolean
  isAudioEnabled: boolean
}

export default function VideoCall({ 
  isOpen, 
  onClose, 
  sessionId, 
  username, 
  socket, 
  targetUserId, 
  isGroupCall = false,
  isAudioOnly = false 
}: VideoCallProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [displayStream, setDisplayStream] = useState<MediaStream | null>(null)
  const [peerConnections, setPeerConnections] = useState<Map<string, RTCPeerConnection>>(new Map())
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isCalling, setIsCalling] = useState(false)
  const [isInCall, setIsInCall] = useState(false)
  const [isLoadingMedia, setIsLoadingMedia] = useState(false)
  const [incomingCall, setIncomingCall] = useState<{
    callerId: string
    callerName: string
    offer?: RTCSessionDescriptionInit
    isAudioCall?: boolean
  } | null>(null)
  const [callParticipants, setCallParticipants] = useState<CallParticipant[]>([])
  const [isMinimized, setIsMinimized] = useState(false)
  const [callStartTime, setCallStartTime] = useState<Date | null>(null)
  const [callDuration, setCallDuration] = useState(0)

  // Device management state
  const [preferredVideoDevice, setPreferredVideoDevice] = useState<string>('')
  const [preferredAudioDevice, setPreferredAudioDevice] = useState<string>('')
  const [availableVideoDevices, setAvailableVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [availableAudioDevices, setAvailableAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [showDeviceSettings, setShowDeviceSettings] = useState(false)
  const [hasRequestedPermissions, setHasRequestedPermissions] = useState(false)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)

  // WebRTC configuration
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }

  // Initialize media on component mount
  useEffect(() => {
    if (isOpen && !localStream && !isLoadingMedia) {
      initializeMedia()
    }
  }, [isOpen])

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (callStartTime) {
      interval = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTime.getTime()) / 1000))
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [callStartTime])

  // Attach streams to video elements when they change
  useEffect(() => {
    console.log('Local stream changed:', localStream)
    if (localStream && localVideoRef.current) {
      console.log('Attaching local stream to video element')
      
      // Use the stream directly for local display
      setDisplayStream(localStream)
      
      localVideoRef.current.srcObject = localStream
      localVideoRef.current.muted = true
      
      // Force video to play with multiple attempts
      const playVideo = async () => {
        try {
          await localVideoRef.current?.play()
          console.log('Local video playing successfully')
        } catch (error: any) {
          console.error('Error playing local video:', error)
          if (error.name === 'NotAllowedError') {
            console.log('Autoplay was prevented - user interaction required')
            // Retry after a short delay
            setTimeout(() => {
              localVideoRef.current?.play().catch(console.error)
            }, 1000)
          }
        }
      }
      
      playVideo()
    }
  }, [localStream])

  useEffect(() => {
    console.log('Remote stream changed:', remoteStream)
    if (remoteStream && remoteVideoRef.current) {
      console.log('Attaching remote stream to video element')
      remoteVideoRef.current.srcObject = remoteStream
      
      // Force video to play with multiple attempts
      const playVideo = async () => {
        try {
          await remoteVideoRef.current?.play()
          console.log('Remote video playing successfully')
        } catch (error: any) {
          console.error('Error playing remote video:', error)
          if (error.name === 'NotAllowedError') {
            console.log('Autoplay was prevented - user interaction required')
            // Retry after a short delay
            setTimeout(() => {
              remoteVideoRef.current?.play().catch(console.error)
            }, 1000)
          }
        }
      }
      
      playVideo()
    }
  }, [remoteStream])

  // Format call duration
  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Render multiple remote video streams
  const renderRemoteVideos = () => {
    const remoteVideoElements = []
    
    // Add remote streams from Map
    for (const [userId, stream] of Array.from(remoteStreams.entries())) {
      remoteVideoElements.push(
        <div key={userId} className="relative w-full h-full">
          <video
            ref={(el) => {
              if (el && stream) {
                el.srcObject = stream
                el.play().catch(console.error)
              }
            }}
            autoPlay
            playsInline
            className="w-full h-full object-cover rounded-lg"
          />
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
            User {userId}
          </div>
        </div>
      )
    }
    
    return remoteVideoElements
  }

  // Device management functions and state are already defined above

  // Get available media devices
  const getMediaDevices = async () => {
    try {
      // Request permissions first if not already done to get device labels
      if (!hasRequestedPermissions) {
        console.log('Requesting basic media permissions to get device labels...')
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          tempStream.getTracks().forEach(track => track.stop())
          setHasRequestedPermissions(true)
        } catch (error) {
          console.error('Failed to get initial permissions for device enumeration:', error)
        }
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      const audioDevices = devices.filter(device => device.kind === 'audioinput')
      
      console.log('Available video devices:', videoDevices)
      console.log('Available audio devices:', audioDevices)
      
      // Update state with available devices
      setAvailableVideoDevices(videoDevices)
      setAvailableAudioDevices(audioDevices)
      
      return { videoDevices, audioDevices }
    } catch (error) {
      console.error('Error enumerating devices:', error)
      return { videoDevices: [], audioDevices: [] }
    }
  }

  // Refresh device list (useful when devices are plugged/unplugged)
  const refreshDevices = async () => {
    console.log('Refreshing device list...')
    await getMediaDevices()
  }

  // Switch to a different camera/microphone
  const switchDevice = async (deviceType: 'video' | 'audio', deviceId: string) => {
    if (!localStream) {
      console.error('Cannot switch device: localStream is null')
      return
    }
    
    try {
      console.log(`Switching ${deviceType} device to:`, deviceId)
      console.log('Current localStream tracks:', {
        video: localStream.getVideoTracks(),
        audio: localStream.getAudioTracks()
      })
      
      // Stop current tracks of the same type
      const tracks = deviceType === 'video' 
        ? localStream.getVideoTracks()
        : localStream.getAudioTracks()
      
      console.log(`Stopping ${tracks.length} ${deviceType} tracks`)
      tracks.forEach(track => {
        console.log(`Stopping track:`, track.label, track.id)
        track.stop()
        localStream.removeTrack(track)
      })
      
      // Get new constraints
      const constraints = {
        video: deviceType === 'video' ? { deviceId: { exact: deviceId } } : false,
        audio: deviceType === 'audio' ? { deviceId: { exact: deviceId } } : false
      }
      
      console.log('Requesting new media with constraints:', constraints)
      
      // Get new stream with selected device
      const newStream = await navigator.mediaDevices.getUserMedia(constraints)
      const newTracks = deviceType === 'video' 
        ? newStream.getVideoTracks()
        : newStream.getAudioTracks()
      
      console.log(`Received ${newTracks.length} new ${deviceType} tracks`)
      
      // Add new tracks to existing stream
      newTracks.forEach(track => {
        console.log(`Adding new track:`, track.label, track.id)
        localStream.addTrack(track)
      })
      
      // Update video element if it's video track
      if (deviceType === 'video' && localVideoRef.current) {
        console.log('Updating local video element with new stream')
        localVideoRef.current.srcObject = localStream
        // Force re-render
        setDisplayStream(localStream)
      }
      
      // Update peer connections with new tracks
      console.log('Updating peer connections with new tracks...')
      peerConnections.forEach((pc, userId) => {
        const sender = pc.getSenders().find(s => 
          s.track && s.track.kind === deviceType
        )
        if (sender && newTracks.length > 0) {
          console.log(`Replacing track for user ${userId}`)
          sender.replaceTrack(newTracks[0])
        } else {
          console.log(`No sender found for ${deviceType} track for user ${userId}`)
        }
      })
      
      // Update preferences
      if (deviceType === 'video') {
        setPreferredVideoDevice(deviceId)
      } else {
        setPreferredAudioDevice(deviceId)
      }
      
      console.log(`Successfully switched ${deviceType} device`)
      console.log('Updated localStream tracks:', {
        video: localStream.getVideoTracks(),
        audio: localStream.getAudioTracks()
      })
    } catch (error: any) {
      console.error(`Error switching ${deviceType} device:`, error)
      console.error('Error details:', {
        name: error.name,
        message: error.message
      })
      alert(`Unable to switch ${deviceType} device. Please try again. Error: ${error.message}`)
    }
  }

  // Initialize media devices with device selection
  const initializeMedia = async () => {
    console.log('Initializing media devices...')
    setIsLoadingMedia(true)
    
    try {
      // First, get available devices if not already done
      if (!hasRequestedPermissions) {
        const { videoDevices, audioDevices } = await getMediaDevices()
        
        // Set preferred devices (first available or previously used)
        if (!preferredVideoDevice && videoDevices.length > 0) {
          setPreferredVideoDevice(videoDevices[0].deviceId)
        }
        if (!preferredAudioDevice && audioDevices.length > 0) {
          setPreferredAudioDevice(audioDevices[0].deviceId)
        }
        
        setHasRequestedPermissions(true)
      }
      
      // Build constraints with device preferences
      const constraints: MediaStreamConstraints = {
        video: isAudioOnly ? false : {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
          deviceId: preferredVideoDevice ? { exact: preferredVideoDevice } : undefined
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          deviceId: preferredAudioDevice ? { exact: preferredAudioDevice } : undefined
        }
      }
      
      console.log('Requesting media with constraints:', constraints)
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      console.log('Media stream obtained:', stream)
      console.log('Video tracks:', stream.getVideoTracks())
      console.log('Audio tracks:', stream.getAudioTracks())
      
      setLocalStream(stream)
      setIsVideoEnabled(!isAudioOnly && stream.getVideoTracks().length > 0)
      
      // Store the actual device IDs used for future reference
      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = stream.getAudioTracks()[0]
      
      if (videoTrack) {
        const settings = videoTrack.getSettings()
        if (settings.deviceId) {
          setPreferredVideoDevice(settings.deviceId)
        }
      }
      
      if (audioTrack) {
        const settings = audioTrack.getSettings()
        if (settings.deviceId) {
          setPreferredAudioDevice(settings.deviceId)
        }
      }
      
      if (localVideoRef.current && !isAudioOnly && stream.getVideoTracks().length > 0) {
        console.log('Setting local video source')
        
        // Use the stream directly for local display
        setDisplayStream(stream)
        
        localVideoRef.current.srcObject = stream
        localVideoRef.current.muted = true
        
        // Force play with retry logic
        const playVideo = async () => {
          try {
            await localVideoRef.current?.play()
            console.log('Local video playing successfully in initializeMedia')
          } catch (error: any) {
            console.error('Error playing local video in initializeMedia:', error)
            if (error.name === 'NotAllowedError') {
              console.log('Autoplay was prevented in initializeMedia - will retry')
              setTimeout(() => {
                localVideoRef.current?.play().catch(console.error)
              }, 1000)
            }
          }
        }
        
        playVideo()
      }
    } catch (error: any) {
      console.error('Error accessing media devices:', error)
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      
      let errorMessage = 'Unable to access camera/microphone. Please check permissions.'
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera/microphone access was denied. Please allow access in your browser settings.'
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera/microphone found. Please check your device.'
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera/microphone is already in use by another application.'
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'The requested media constraints could not be satisfied. Trying with default settings...'
        // Try again with basic constraints
        try {
          const basicConstraints = {
            video: isAudioOnly ? false : true,
            audio: true
          }
          const stream = await navigator.mediaDevices.getUserMedia(basicConstraints)
          setLocalStream(stream)
          setIsVideoEnabled(!isAudioOnly && stream.getVideoTracks().length > 0)
          
          if (localVideoRef.current && !isAudioOnly && stream.getVideoTracks().length > 0) {
            setDisplayStream(stream)
            localVideoRef.current.srcObject = stream
            localVideoRef.current.muted = true
            localVideoRef.current.play().catch(console.error)
          }
          
          return // Success with basic constraints
        } catch (retryError) {
          console.error('Basic constraints also failed:', retryError)
        }
      }
      
      alert(errorMessage)
    } finally {
      setIsLoadingMedia(false)
    }
  }

  // Create peer connection for a specific user
  const createPeerConnection = (userId: string) => {
    const peerConnection = new RTCPeerConnection(iceServers)
    
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('iceCandidate', {
          targetUserId: userId,
          candidate: event.candidate,
          fromUserId: sessionId
        })
      }
    }

    peerConnection.ontrack = (event) => {
      console.log(`Received remote stream from ${userId}:`, event.streams[0])
      console.log('Remote stream tracks:', event.streams[0]?.getTracks())
      
      if (event.streams[0]) {
        setRemoteStreams(prev => new Map(prev.set(userId, event.streams[0])))
      }
    }

    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state with ${userId}:`, peerConnection.connectionState)
      if (peerConnection.connectionState === 'connected') {
        setIsInCall(true)
        setCallStartTime(new Date())
      }
    }

    // Add local stream tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream)
      })
    }

    return peerConnection
  }

  // Create peer connection (legacy single user support)
  const createSinglePeerConnection = () => {
    const peerConnection = new RTCPeerConnection(iceServers)
    
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('iceCandidate', {
          targetUserId: targetUserId || sessionId,
          candidate: event.candidate
        })
      }
    }

    peerConnection.ontrack = (event) => {
      console.log('Received remote stream:', event.streams[0])
      console.log('Remote stream tracks:', event.streams[0]?.getTracks())
      
      if (event.streams[0]) {
        // Use the stream directly without cloning for peer connection
        setRemoteStream(event.streams[0])
        
        if (remoteVideoRef.current) {
          console.log('Setting remote video source in ontrack')
          remoteVideoRef.current.srcObject = event.streams[0]
          
          // Force play with retry logic
          const playVideo = async () => {
            try {
              await remoteVideoRef.current?.play()
              console.log('Remote video playing successfully in ontrack')
            } catch (error: any) {
              console.error('Error playing remote video in ontrack:', error)
              if (error.name === 'NotAllowedError') {
                console.log('Autoplay was prevented in ontrack - will retry')
                setTimeout(() => {
                  remoteVideoRef.current?.play().catch(console.error)
                }, 1000)
              }
            }
          }
          
          playVideo()
        }
      }
    }

    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', peerConnection.connectionState)
      if (peerConnection.connectionState === 'connected') {
        setIsInCall(true)
        setCallStartTime(new Date())
      }
    }

    // Add local stream tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream)
      })
    }

    peerConnectionRef.current = peerConnection
    return peerConnection
  }

  // Start multi-user call
  const startMultiUserCall = async (participantIds: string[]) => {
    if (!socket || !localStream) return

    setIsCalling(true)
    
    // Create peer connections for each participant
    const newPeerConnections = new Map<string, RTCPeerConnection>()
    
    for (const participantId of participantIds) {
      if (participantId === sessionId) continue // Skip self
      
      const peerConnection = createPeerConnection(participantId)
      newPeerConnections.set(participantId, peerConnection)
      
      try {
        const offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)
        
        socket.emit('videoCallOffer', {
          sessionId,
          targetUserId: participantId,
          offer,
          callerName: username,
          isMultiUser: true
        })
      } catch (error) {
        console.error(`Error creating offer for ${participantId}:`, error)
      }
    }
    
    setPeerConnections(newPeerConnections)
    
    setTimeout(() => {
      if (!isInCall) {
        setIsCalling(false)
        alert('Call timeout - no answer received')
      }
    }, 30000)
  }

  // Start video call
  const startCall = async () => {
    if (!socket) return

    // Initialize media if not already done
    if (!localStream) {
      console.log('Initializing media for call start...')
      try {
        await initializeMedia()
      } catch (error) {
        console.error('Failed to initialize media for call start:', error)
        alert('Failed to access camera/microphone. Please check permissions.')
        return
      }
    }

    // Ensure local stream is available
    if (!localStream) {
      console.error('Local stream not available for call start')
      return
    }

    setIsCalling(true)
    const peerConnection = createSinglePeerConnection()

    try {
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)

      if (isAudioOnly) {
        socket.emit('audioCallRequest', {
          sessionId,
          targetUserId,
          callerName: username
        })

        socket.emit('audioCallOffer', {
          sessionId,
          targetUserId: targetUserId || sessionId,
          offer,
          callerName: username
        })
      } else {
        socket.emit('videoCallRequest', {
          sessionId,
          targetUserId,
          callerName: username
        })

        socket.emit('videoCallOffer', {
          sessionId,
          targetUserId: targetUserId || sessionId,
          offer,
          callerName: username
        })
      }

      setTimeout(() => {
        if (!isInCall) {
          setIsCalling(false)
          alert('Call timeout - no answer received')
        }
      }, 30000) // 30 second timeout

    } catch (error: any) {
      console.error('Error starting call:', error)
      setIsCalling(false)
    }
  }

  // Answer incoming call
  const answerCall = async (offer: RTCSessionDescriptionInit) => {
    if (!socket) return

    // Initialize media if not already done
    if (!localStream) {
      console.log('Initializing media for call answer...')
      try {
        await initializeMedia()
      } catch (error) {
        console.error('Failed to initialize media for call answer:', error)
        alert('Failed to access camera/microphone. Please check permissions.')
        return
      }
    }

    // Wait a bit for media to be ready
    if (!localStream) {
      console.error('Local stream not available after initialization')
      return
    }

    const peerConnection = createSinglePeerConnection()

    try {
      await peerConnection.setRemoteDescription(offer)
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)

      // Emit the appropriate answer event based on incoming call type
      if (incomingCall?.isAudioCall) {
        socket.emit('audioCallAnswer', {
          targetUserId: incomingCall?.callerId,
          answer
        })
      } else {
        socket.emit('videoCallAnswer', {
          targetUserId: incomingCall?.callerId,
          answer
        })
      }

      setIncomingCall(null)
      setIsInCall(true)
      setCallStartTime(new Date())

    } catch (error: any) {
      console.error('Error answering call:', error)
    }
  }

  // End call
  const endCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    // Clean up all streams
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop())
      setLocalStream(null)
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop())
      setRemoteStream(null)
    }

    if (displayStream) {
      displayStream.getTracks().forEach(track => track.stop())
      setDisplayStream(null)
    }

    if (socket) {
      if (isAudioOnly) {
        socket.emit('audioCallEnd', {
          targetUserId: targetUserId || sessionId,
          sessionId
        })
      } else {
        socket.emit('videoCallEnd', {
          targetUserId: targetUserId || sessionId,
          sessionId
        })
      }
    }

    setIsCalling(false)
    setIsInCall(false)
    setIncomingCall(null)
    setCallStartTime(null)
    setCallDuration(0)
    
    // Clear video element sources
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }
    
    onClose()
  }

  // Toggle video
  const toggleVideo = async () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        if (isVideoEnabled) {
          // Disable video - remove track from stream and peer connection
          console.log('Disabling video track')
          videoTrack.stop()
          localStream.removeTrack(videoTrack)
          
          // Remove from peer connection if active
          if (peerConnectionRef.current) {
            const sender = peerConnectionRef.current.getSenders().find(s => 
              s.track && s.track.kind === 'video'
            )
            if (sender) {
              peerConnectionRef.current.removeTrack(sender)
            }
          }
          
          setIsVideoEnabled(false)
        } else {
          // Enable existing track
          videoTrack.enabled = true
          setIsVideoEnabled(true)
          console.log('Video track enabled')
        }
      } else if (!isVideoEnabled) {
        // Need to add video track - get new video stream
        console.log('Adding video track to stream')
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user'
            }
          })
          
          const newVideoTrack = videoStream.getVideoTracks()[0]
          if (newVideoTrack) {
            // Add the new video track to the existing stream
            localStream.addTrack(newVideoTrack)
            
            // Also add to peer connection if active
            if (peerConnectionRef.current) {
              peerConnectionRef.current.addTrack(newVideoTrack, localStream)
            }
            
            setIsVideoEnabled(true)
            console.log('Video track added successfully')
          }
        } catch (error) {
          console.error('Error adding video track:', error)
        }
      }
    }
  }

  // Toggle audio
  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled
        setIsAudioEnabled(!isAudioEnabled)
      }
    }
  }

  // Socket event handlers
  useEffect(() => {
    if (!socket) return

    const handleVideoCallRequest = (data: { callerId: string; callerName: string; sessionId: string }) => {
      if (data.callerId !== socket.id) {
        setIncomingCall({ ...data, isAudioCall: false })
      }
    }

    const handleVideoCallOffer = async (data: { offer: RTCSessionDescriptionInit; callerId: string; callerName: string }) => {
      if (data.callerId !== socket.id) {
        setIncomingCall({ callerId: data.callerId, callerName: data.callerName, offer: data.offer, isAudioCall: false })
      }
    }

    const handleAudioCallRequest = (data: { callerId: string; callerName: string; sessionId: string }) => {
      if (data.callerId !== socket.id) {
        setIncomingCall({ ...data, isAudioCall: true })
      }
    }

    const handleAudioCallOffer = async (data: { offer: RTCSessionDescriptionInit; callerId: string; callerName: string }) => {
      if (data.callerId !== socket.id) {
        setIncomingCall({ callerId: data.callerId, callerName: data.callerName, offer: data.offer, isAudioCall: true })
      }
    }

    const handleVideoCallAnswer = async (data: { answer: RTCSessionDescriptionInit }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(data.answer)
      }
    }

    const handleAudioCallAnswer = async (data: { answer: RTCSessionDescriptionInit }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(data.answer)
      }
    }

    const handleIceCandidate = (data: { candidate: RTCIceCandidateInit }) => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.addIceCandidate(data.candidate)
      }
    }

    const handleVideoCallEnd = () => {
      setIsCalling(false)
      setIsInCall(false)
      setIncomingCall(null)
      setCallStartTime(null)
      setCallDuration(0)
      
      // Clear peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
      }
      
      // Clear all streams
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop())
        setLocalStream(null)
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop())
        setRemoteStream(null)
      }
      if (displayStream) {
        displayStream.getTracks().forEach(track => track.stop())
        setDisplayStream(null)
      }
      
      // Clear video element sources
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null
      }
      
      onClose()
    }

    const handleAudioCallEnd = () => {
      setIsCalling(false)
      setIsInCall(false)
      setIncomingCall(null)
      setCallStartTime(null)
      setCallDuration(0)
      
      // Clear peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
      }
      
      // Clear all streams
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop())
        setLocalStream(null)
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop())
        setRemoteStream(null)
      }
      if (displayStream) {
        displayStream.getTracks().forEach(track => track.stop())
        setDisplayStream(null)
      }
      
      // Clear video element sources
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null
      }
      
      onClose()
    }

    socket.on('videoCallRequest', handleVideoCallRequest)
    socket.on('videoCallOffer', handleVideoCallOffer)
    socket.on('videoCallAnswer', handleVideoCallAnswer)
    socket.on('audioCallRequest', handleAudioCallRequest)
    socket.on('audioCallOffer', handleAudioCallOffer)
    socket.on('audioCallAnswer', handleAudioCallAnswer)
    socket.on('iceCandidate', handleIceCandidate)
    socket.on('videoCallEnd', handleVideoCallEnd)
    socket.on('audioCallEnd', handleAudioCallEnd)

    return () => {
      socket.off('videoCallRequest', handleVideoCallRequest)
      socket.off('videoCallOffer', handleVideoCallOffer)
      socket.off('videoCallAnswer', handleVideoCallAnswer)
      socket.off('audioCallRequest', handleAudioCallRequest)
      socket.off('audioCallOffer', handleAudioCallOffer)
      socket.off('audioCallAnswer', handleAudioCallAnswer)
      socket.off('iceCandidate', handleIceCandidate)
      socket.off('videoCallEnd', handleVideoCallEnd)
      socket.off('audioCallEnd', handleAudioCallEnd)
    }
  }, [socket])

  // Initialize media on component mount
  useEffect(() => {
    if (isOpen) {
      initializeMedia().catch(console.error)
    }
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop())
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className={`fixed inset-0 z-50 ${isMinimized ? 'bg-transparent' : 'bg-black/80'} flex items-center justify-center`}>
      <Card className={`${isMinimized ? 'w-80 h-60' : 'w-full max-w-6xl h-full max-h-[90vh]'} flex flex-col`}>
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            {isAudioOnly ? <Phone className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            {isAudioOnly ? 'Audio Call' : 'Video Call'}
            {isInCall && (
              <Badge variant="secondary" className="ml-2">
                {formatCallDuration(callDuration)}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMinimized(!isMinimized)}
              className="h-8 w-8"
            >
              {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={endCall}
              className="h-8 w-8 text-red-500 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0">
          {!isInCall && !incomingCall && !isCalling && (
            <div className="flex flex-col items-center justify-center h-full p-8">
              <div className="text-center mb-8">
                {isAudioOnly ? <Phone className="w-16 h-16 text-muted-foreground mx-auto mb-4" /> : <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4" />}
                <h3 className="text-xl font-semibold mb-2">
                  {isLoadingMedia ? (isAudioOnly ? 'Initializing microphone...' : 'Initializing camera...') : (isAudioOnly ? 'Ready to start audio call' : 'Ready to start video call')}
                </h3>
                {!isLoadingMedia && (
                  <p className="text-muted-foreground">
                    {targetUserId ? `Call ${targetUserId}` : `Start a ${isAudioOnly ? 'audio' : 'video'} call`}
                  </p>
                )}
              </div>
              {isLoadingMedia ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
              ) : (
                <div className="flex flex-col gap-3">
                  <Button
                    onClick={startCall}
                    size="lg"
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    <Phone className="w-5 h-5 mr-2" />
                    Start {isAudioOnly ? 'Audio' : 'Video'} Call
                  </Button>
                  {!targetUserId && (
                    <Button
                      onClick={() => startMultiUserCall([])}
                      size="lg"
                      variant="outline"
                      className="border-blue-500 text-blue-500 hover:bg-blue-50"
                    >
                      <Users className="w-5 h-5 mr-2" />
                      Start Group {isAudioOnly ? 'Audio' : 'Video'} Call
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {isCalling && (
            <div className="flex flex-col items-center justify-center h-full p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mb-4 animate-pulse">
                  <Phone className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Calling...</h3>
                <p className="text-muted-foreground">Waiting for answer</p>
              </div>
              <Button
                onClick={endCall}
                variant="destructive"
                size="lg"
              >
                <PhoneOff className="w-5 h-5 mr-2" />
                Cancel Call
              </Button>
            </div>
          )}

          {incomingCall && (
            <div className="flex flex-col items-center justify-center h-full p-8">
              <div className="text-center mb-8">
                <Avatar className="w-16 h-16 mx-auto mb-4">
                  <AvatarFallback className="bg-blue-500 text-white">
                    {incomingCall.callerName?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-xl font-semibold mb-2">Incoming {incomingCall.isAudioCall ? 'Audio' : 'Video'} Call</h3>
                <p className="text-muted-foreground">{incomingCall.callerName} is calling you</p>
              </div>
              <div className="flex gap-4">
                <Button
                  onClick={() => {
                    if (incomingCall?.offer) {
                      answerCall(incomingCall.offer)
                    }
                  }}
                  size="lg"
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  <Phone className="w-5 h-5 mr-2" />
                  Answer
                </Button>
                <Button
                  onClick={() => {
                    setIncomingCall(null)
                    endCall()
                  }}
                  variant="destructive"
                  size="lg"
                >
                  <PhoneOff className="w-5 h-5 mr-2" />
                  Decline
                </Button>
              </div>
            </div>
          )}

          {isInCall && (
            <div className="flex flex-col h-full">
              {/* Video/Audio Grid */}
              <div className={`flex-1 relative ${isAudioOnly ? 'bg-gray-900' : 'bg-black'} rounded-lg overflow-hidden`}>
                {!isAudioOnly && (
                  <>
                    {/* Multi-User Video Grid */}
                    {isGroupCall ? (
                      <div className="grid grid-cols-2 gap-2 h-full p-2">
                        {/* Local Video */}
                        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
                          <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                            style={{ display: displayStream && isVideoEnabled ? 'block' : 'none' }}
                          />
                          {!isVideoEnabled && (
                            <div className="absolute inset-0 flex items-center justify-center text-white">
                              <VideoOff className="w-12 h-12 opacity-50" />
                            </div>
                          )}
                          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                            You ({username})
                          </div>
                        </div>
                        
                        {/* Remote Videos */}
                        {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
                          <div key={userId} className="relative bg-gray-800 rounded-lg overflow-hidden">
                            <video
                              ref={(el) => {
                                if (el && stream) {
                                  el.srcObject = stream
                                  el.play().catch(console.error)
                                }
                              }}
                              autoPlay
                              playsInline
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                              User {userId}
                            </div>
                          </div>
                        ))}
                        
                        {/* Empty slots for remaining participants */}
                        {remoteStreams.size < 3 && (
                          <div className="relative bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center">
                            <Users className="w-12 h-12 text-gray-400" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Single Remote Video (Legacy) */}
                        {console.log('Rendering remote video - remoteStream:', remoteStream, 'isVideoEnabled:', isVideoEnabled)}
                        <video
                          ref={remoteVideoRef}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover"
                          style={{ display: remoteStream && isVideoEnabled ? 'block' : 'none' }}
                        />
                        
                        {/* Local Video (Picture-in-Picture) */}
                        <div 
                          className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden border-2 border-white"
                          style={{ display: displayStream && isVideoEnabled ? 'block' : 'none' }}>
                          <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </>
                    )}
                  </>
                )}

                {isAudioOnly ? (
                  <div className="absolute inset-0 flex items-center justify-center text-white">
                    <div className="text-center">
                      <Phone className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>Audio call in progress...</p>
                      <p className="text-sm text-gray-400 mt-2">{formatCallDuration(callDuration)}</p>
                    </div>
                  </div>
                ) : !isVideoEnabled ? (
                  <div className="absolute inset-0 flex items-center justify-center text-white">
                    <div className="text-center">
                      <VideoOff className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>Video is disabled</p>
                      <p className="text-sm text-gray-400 mt-2">Audio call in progress</p>
                    </div>
                  </div>
                ) : !remoteStream ? (
                  <div className="absolute inset-0 flex items-center justify-center text-white">
                    <div className="text-center">
                      <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>Waiting for participant to join...</p>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Call Controls */}
              <div className="flex items-center justify-center gap-4 p-4 bg-background border-t">
                <Button
                  onClick={toggleAudio}
                  variant={isAudioEnabled ? "outline" : "destructive"}
                  size="icon"
                  className="w-12 h-12 rounded-full"
                >
                  {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </Button>

                <Button
                  onClick={endCall}
                  variant="destructive"
                  size="icon"
                  className="w-12 h-12 rounded-full"
                >
                  <PhoneOff className="w-5 h-5" />
                </Button>

                {!isAudioOnly && (
                  <>
                    <Button
                      onClick={toggleVideo}
                      variant={isVideoEnabled ? "outline" : "destructive"}
                      size="icon"
                      className="w-12 h-12 rounded-full"
                    >
                      {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={async () => {
                        const newShowState = !showDeviceSettings
                        setShowDeviceSettings(newShowState)
                        if (newShowState) {
                          console.log('Opening device settings, refreshing devices...')
                          await refreshDevices()
                        }
                      }}
                      className="w-12 h-12 rounded-full"
                    >
                      <Settings className="w-5 h-5" />
                    </Button>
                  </>
                )}
              </div>

              {/* Device Settings Panel */}
              {isInCall && showDeviceSettings && (
                <div className="p-4 bg-gray-50 border-t">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium text-gray-700">Device Settings</h4>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={refreshDevices}
                      className="text-xs"
                    >
                      Refresh Devices
                    </Button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Camera
                      </label>
                      <select
                        value={preferredVideoDevice}
                        onChange={(e) => switchDevice('video', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md text-sm"
                        disabled={isAudioOnly}
                      >
                        {availableVideoDevices.length > 0 ? (
                          availableVideoDevices.map((device) => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                            </option>
                          ))
                        ) : (
                          <option value="">No cameras detected</option>
                        )}
                      </select>
                      {availableVideoDevices.length === 0 && (
                        <p className="text-xs text-gray-500 mt-1">No cameras available. Click Refresh Devices to detect.</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Microphone
                      </label>
                      <select
                        value={preferredAudioDevice}
                        onChange={(e) => switchDevice('audio', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md text-sm"
                      >
                        {availableAudioDevices.length > 0 ? (
                          availableAudioDevices.map((device) => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                            </option>
                          ))
                        ) : (
                          <option value="">No microphones detected</option>
                        )}
                      </select>
                      {availableAudioDevices.length === 0 && (
                        <p className="text-xs text-gray-500 mt-1">No microphones available. Click Refresh Devices to detect.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}