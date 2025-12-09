import Documents from '../components/Editor/Documents' 
import ChatInterface from '../components/ai/ChatInterface'
import AuthWrapper from '../components/auth/AuthWrapper'
import Editor from '../components/Editor/Editor'
import EditorWithHchldernNodesEditing from '../components/Editor/EditorChildEditing-v1'
import BasicsGrapejsGeminiStreaming from '../components/Editor/BasicsGrapejs-gemini-streaming'


function page() {
  return (
    // <AuthWrapper>
    <>
      <BasicsGrapejsGeminiStreaming/>
        {/* <ChatInterface/> */}
        {/* <EditorWithHchldernNodesEditing/> */}
        {/* <Editor/> */}
    </>
        // <Documents/>
        // </AuthWrapper>
  )
}

export default page
