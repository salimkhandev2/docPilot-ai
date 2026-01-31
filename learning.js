async function getPosts() {
    let message= await Promise.resolve("Hello")
    console.log(message)
    return message
}

getPosts()

