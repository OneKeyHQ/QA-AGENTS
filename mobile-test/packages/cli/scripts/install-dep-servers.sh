#!/bin/bash

npm install -g wdio

# Check and install Appium
if ! command -v appium &> /dev/null
then
    echo "Appium is not installed, installing now..."
    npm i --location=global appium
    appium driver install xcuitest
    appium driver install uiautomator2
else
    echo "Appium is already installed."
fi

# Check and install Electron
if ! command -v electron &> /dev/null
then
    echo "Electron is not installed, installing now..."
    npm install -g electron
else
    echo "Electron is already installed."
fi

# Check and install PM2
if ! command -v pm2 &> /dev/null
then
    echo "PM2 is not installed, installing now..."
    npm install -g pm2
else
    echo "PM2 is already installed."
fi

