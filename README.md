# A Simple Embeddable React Widget with OpenAI Integration

This project provides a simple template for an embeddable React widget that can be inserted into a host website using a single `<script>` tag. It supports JSX, CSS styles, and is compiled using Webpack into a single `.js` file that can be static-hosted. Additionally, it leverages OpenAI's API to process user inputs, generate responses, or enhance interactivity within the widget.

---

## Overview  
1. The widget is instantiated when the `.js` package is loaded.  
2. The host page supplies a **name** and a **targetElementId**.  
3. The widget registers a global object with the name supplied by the host page.  
4. The widget renders the React component at the specified element on the host page.  
5. The host page can communicate with the widget via the global object.  
6. OpenAI's API can be used to process user inputs, provide AI-generated responses, or power interactive elements within the widget.  

---

## Demo
![Alt text](assets/chatbot_response.png)

## Usage Example 
This method uses a simple `<script>` tag reference as shown below:  

```html
<div id="root"></div>  
  
<script src="https://somehost/widget.js"  
        id="Simple-Widget-Script"  
        data-config="{'name': 'w1', 'config': {'targetElementId': 'root'}}">  
</script>
```

The `data-config` attribute passes in the name **w1** for the widget's global object and the target element ID **root** where the widget should be rendered.  

The host page can then communicate with the widget via the global object, such as sending a message:  

```html
<div><button onclick="w1('message', 'Hello world!');">Send Message</button></div>
```

This follows a pattern similar to Google Analytics, where the function records the desired global object name (**w1**) and queues any calls made to the widget before asynchronous loading completes. The script dynamically injects itself into the DOM and initializes the widget with the following command:

```html
w1('init', { targetElementId: 'root' });
```

---

## OpenAI Integration  
This widget can be enhanced with OpenAI’s API to process user inputs and provide intelligent responses. Below is an example of how the widget can interact with OpenAI’s API: 

---

## Running the Project  
### Install dependencies  
```sh
npm install
```

### Run the development server  
```sh
./node_modules/.bin/webpack-dev-server --open
```

### Build the package  
```sh
./node_modules/.bin/webpack --config webpack.config.js
```

### Run Tests  
```sh
npm test
