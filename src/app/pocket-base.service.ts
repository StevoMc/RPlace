import { Injectable } from '@angular/core';
import PocketBase from 'pocketbase';

@Injectable({
  providedIn: 'root'
})
export class PocketBaseService {
  public readonly pb: PocketBase

  constructor() { 
    this.pb = new PocketBase('https://pb.fs223.de')
  }
}
