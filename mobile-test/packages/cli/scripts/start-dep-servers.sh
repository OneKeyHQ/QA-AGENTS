#!/bin/bash

ln -s ~/artifacts ./artifacts

if ! pm2 list | grep -q appium
then
    echo "Starting Appium with PM2..."
    pm2 start appium --name "appium"
    pm2_save_required=true
else
    echo "Appium is already running under PM2."
fi

if ! pm2 list | grep -q chromedriver
then
    echo "Starting Chromedriver with PM2..."
    pm2 start aritifacts/chromedriver --name "chromedriver"
    pm2_save_required=true
else
    echo "Chromedriver is already running under PM2."
fi

if [ "$pm2_save_required" = true ]; then
    echo "Saving PM2 configuration..."
    pm2 save
else
    echo "PM2 configuration already saved."
fi

if [ "$pm2_save_required" = true ]; then
    echo "Setting up PM2 to start on system boot..."
    pm2 startup
else
    echo "PM2 is already set up to start on system boot."
fi