import { useState, useEffect } from 'react';
import { useCamera } from '@ionic/react-hooks/camera';
import { useFilesystem, base64FromPath } from '@ionic/react-hooks/filesystem';
import { useStorage } from '@ionic/react-hooks/storage';
import { isPlatform } from '@ionic/react';
import {
  CameraResultType,
  CameraSource,
  CameraPhoto,
  Capacitor,
  FilesystemDirectory,
} from '@capacitor/core';

const PHOTO_STORAGE = 'photos';

export function usePhotoGallery() {
  const { getPhoto } = useCamera();
  const { deleteFile, readFile, writeFile } = useFilesystem();
  const { get, set } = useStorage();

  const [photos, setPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    const loadSaved = async () => {
      const photosString = await get(PHOTO_STORAGE);
      let photosInStorage = (photosString ? JSON.parse(photosString) : []) as Photo[];

      if (!isPlatform('hybrid')) {
       
        photosInStorage = await Promise.all(
          photosInStorage.map(async (photo) => {
            const file = await readFile({
              path: photo.filepath,
              directory: FilesystemDirectory.Data,
            });
            return { ...photo, base64: `data:image/jpeg;base64,${file.data}` };
          })
        );
      }
      console.log(photosInStorage)
      setPhotos(photosInStorage);
    };
    loadSaved();
  }, [get, readFile]);

  const takePhoto = async () => {
    const cameraPhoto = await getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 100,
    });

    const fileName = new Date().getTime() + '.jpeg';
    const savedFileImage = await savePhoto(cameraPhoto, fileName);
    const newPhotos = [savedFileImage, ...photos];
    console.log(newPhotos);
    setPhotos(newPhotos);

    // Don't save the base64 representation of the photo data,
    // since it's already saved on the Filesystem
    set(
      PHOTO_STORAGE,
      isPlatform('hybrid')
        ? JSON.stringify(newPhotos)
        : JSON.stringify(
            newPhotos.map((p) => {
              // Don't save the base64 representation of the photo data,
              // since it's already saved on the Filesystem
              const photoCopy = { ...p };
              delete photoCopy.base64;
              return photoCopy;
            })
          )
    );
  };

  const savePhoto = async (
    photo: CameraPhoto,
    fileName: string
  ): Promise<Photo> => {
    let base64Data: string;

    if (isPlatform('hybrid')) {
      const file = await readFile({
        path: photo.path!,
      });
      base64Data = file.data;
    } else {
      base64Data = await base64FromPath(photo.webPath!);
    }

    const savedFile = await writeFile({
      path: fileName,
      data: base64Data,
      directory: FilesystemDirectory.Data,
    });

    if (isPlatform('hybrid')) {
      return {
        filepath: savedFile.uri,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri),
      };
    } else {
      return {
        filepath: fileName,
        webviewPath: photo.webPath,
      };
    }
  };

  const deletePhoto = async (photo: Photo) => {
    // Remove this photo from the Photos reference data array
    const newPhotos = photos.filter((p) => p.filepath !== photo.filepath);

    // Update photos array cache by overwriting the existing photo array
    set(PHOTO_STORAGE, JSON.stringify(newPhotos));

    // delete photo file from filesystem
    const filename = photo.filepath.substr(photo.filepath.lastIndexOf('/') + 1);
    await deleteFile({
      path: filename,
      directory: FilesystemDirectory.Data,
    });
    setPhotos(newPhotos);
  };

  return {
    deletePhoto,
    photos,
    takePhoto,
  };
}

export interface Photo {
  filepath: string;
  webviewPath?: string;
  base64?: string;
}
